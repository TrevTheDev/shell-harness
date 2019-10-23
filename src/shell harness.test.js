/* eslint-disable no-unused-expressions */
import ShellHarness from './shell harness'

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)

const {expect} = chai

describe('shell queue', () => {
  let shell
  before(async () => {
    shell = new ShellHarness()
  })
  after(() => shell.close())
  it('send custom command', async () => {
    const cmd = await shell.createCommand('printf HELLO ;')
    expect(cmd.output).to.equal(`HELLO`)
  })

  it('sends events', async () => {
    const cmd = shell.createCommand('printf HELLO ;')
    let i = 0
    expect(cmd.state).to.equal(`created`)
    cmd.on('enqueued', () => {
      expect(cmd.state).to.equal(`enqueued`)
      i += 1
      expect(i).to.equal(1)
    })
    cmd.on('executing', () => {
      expect(cmd.state).to.equal(`executing`)
      i += 1
      expect(i).to.equal(2)
    })
    cmd.on('data', () => {
      expect(cmd.state).to.equal(`receiving data`)
      i += 1
      expect(i).to.equal(3)
    })
    await cmd
    expect(cmd.state).to.equal(`finished`)
  })

  it('interact with stdin', async () => {
    const cmdLine = shell.interact('echo "what is your name?" ; read name;\n')
    cmdLine.on('data', stdout => {
      if (stdout === 'what is your name?\n') {
        cmdLine.stdin.write('Bob\necho $name\n ')
        cmdLine.sendDoneMarker() // required to indicate that this interaction is completed
      } else {
        console.log(stdout) // Bob\n
      }
    })
    const outcome = await cmdLine
    expect(outcome.output).to.equal(`what is your name?\nBob\n`)
  })

  it('provides a root shell', async () => {
    const rootShell = new ShellHarness({
      user: 'root',
      rootPassword: process.env.RPASSWORD
    })
    const cmd = await rootShell.createCommand('whoami;')
    expect(`${cmd.output}`).to.equal('root\n')
    expect(rootShell.config.rootPassword).to.not.exist
    rootShell.close()
  })

  it('provides a different user shell', async () => {
    const rootShell = new ShellHarness({
      user: 'testusr',
      rootPassword: process.env.RPASSWORD
    })
    const cmd = await rootShell.createCommand('whoami;')
    expect(`${cmd.output}`).to.equal('testusr\n')
    expect(rootShell.config.rootPassword).to.not.exist
    rootShell.close()
  })

  it('fails if user does not exist', async () => {
    const rootShell = new ShellHarness({
      user: 'doesNotExist',
      rootPassword: process.env.RPASSWORD
    })
    await expect(rootShell.createCommand('whoami;')).to.throw
    rootShell.close()
  })

  it('fails if wrong password is provided', async () => {
    const rootShell = new ShellHarness({
      user: 'root',
      rootPassword: 'wrongPassword'
    })
    await expect(rootShell.createCommand('whoami;')).to.throw
    rootShell.close()
  })

  it('can intercept return', async () => {
    const cb1 = async (cmdx, cbData) => {
      expect(cbData).to.equal('HIT')
      const x = new Promise(resolve => setTimeout(() => resolve(true, 20)))
      const y = await x
      return y
    }
    const cmd = await shell.createCommand('printf HELLO ;', 'HIT', cb1)
    expect(cmd).to.be.true

    const cb2 = (cmdy, cbData) => {
      expect(cbData).to.equal('TWO')
      return 'done'
    }
    const cbShell = new ShellHarness({
      doneCallback: cb2
    })
    const cmd2 = await cbShell.createCommand('printf HELLO ;', 'TWO')
    expect(cmd2).to.equal('done')
    cbShell.close()
  })

  it('receive data via ipc', async () => {
    const cmd = shell.interact(
      'printf "{\\"ipc\\": \\"true\\"}\\n" 1>&$NODE_CHANNEL_FD ; printf HELLO ; \n'
    )
    cmd.on('message', data => {
      console.log(data)
      expect(data.ipc).to.equal('true')
      cmd.sendDoneMarker()
    })
    const res = await cmd
    expect(res.output).to.equal(`HELLO`)
  })
  it('send data via ipc', async () => {
    const cmd = shell.interact('echo ; \n')
    cmd.on('data', stdout => {
      console.log(stdout)
      if (stdout === '\n') {
        cmd.sendMessage('HELLOBOB')
        cmd.stdin.write('read -r line <&3 ; printf $line ; \n')
        cmd.sendDoneMarker()
      }
    })
    const res = await cmd
    expect(res.output).to.equal(`\n"HELLOBOB"`)
  })
})

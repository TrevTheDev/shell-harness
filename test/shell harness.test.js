/* eslint-disable no-unused-expressions */

import { spawn } from 'child_process'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import ShellHarness from '../src/shell harness.js'

chai.use(chaiAsPromised)

const { expect } = chai

describe('shell queue', () => {
  let shell
  before(async () => {
    shell = new ShellHarness()
  })
  after(() => shell.close())
  it('send custom command', async () => {
    const cmd = await shell.createCommand('printf HELLO ;')
    expect(cmd.output).to.equal('HELLO')
  })

  it('sends events', async () => {
    const cmd = shell.createCommand('printf HELLO ;')
    let i = 0
    expect(cmd.state).to.equal('created')
    cmd.on('enqueued', () => {
      expect(cmd.state).to.equal('enqueued')
      i += 1
      expect(i).to.equal(1)
    })
    cmd.on('executing', () => {
      expect(cmd.state).to.equal('executing')
      i += 1
      expect(i).to.equal(2)
    })
    cmd.on('data', () => {
      expect(cmd.state).to.equal('receiving data')
      i += 1
      expect(i).to.equal(3)
    })
    await cmd
    expect(cmd.state).to.equal('finished')
  })

  it('interact with stdin', async () => {
    const cmdLine = shell.interact('echo "what is your name?" ; read name;\n')
    cmdLine.on('data', (stdout) => {
      if (stdout === 'what is your name?\n') {
        cmdLine.stdin.write('Bob\necho $name\n ')
        cmdLine.sendDoneMarker() // required to indicate that this interaction is completed
      } else
        console.log(stdout) // Bob\n
    })
    const outcome = await cmdLine
    expect(outcome.output).to.equal('what is your name?\nBob\n')
  })

  it('sending data via fd', async () => {
    await shell.createCommand('rm dummy;')
    await shell.createCommand('rm dummy2;')
    const cmdLine = shell.interact('\n')
    cmdLine.on('executing', () => {
      // cmdLine.stdin.write('exec 4<>dummy;')
      // const stdin4 = cmdLine._command.shellQueue.process.stdio[4]
      cmdLine.stdin.write('ls -la /proc/$$/fd;\n')
      cmdLine.stdin.write('sudo -K;\n')
      cmdLine.stdin.write(`echo "${process.env.RPASSWORD}";\n`)
      cmdLine.stdin.write('sudo -p PaxsWord -S su root 2>&1;\n')
      setTimeout(() => {
        cmdLine.stdin.write(`${process.env.RPASSWORD}\n`)
        cmdLine.stdin.write('echo "------------------------";\n')
        cmdLine.stdin.write('ls -la /proc/$$/fd;\n')
        cmdLine.sendDoneMarker()
        // Something you want delayed.
      }, 10)

      // stdin4.end()
      // cmdLine.stdin.write('cat <&4 >dummy2;\n')
      // stdin4.write('NEXT')
      // cmdLine._command.shellQueue.process.stdio[4].end()
      // cmdLine.stdin.write('echo TEST >&10;\n')
      // cmdLine.stdin.write('exec 4<&-;\n')
    })
    cmdLine.on('data', (stdout) => {
      console.log(stdout) // Bob\n
    })
    const outcome = await cmdLine
    console.log(outcome.output)
  })

  it('fails if stdout', () => {
    const cmdF = shell.interact('echo stdOutNotSupported 1>&2;\n')
    cmdF.catch((error) => {
      console.log(error)
      shell.createCommand('printf HELLO;').then((cmd) => {
        expect(cmd.output).to.equal('HELLO')
      })
    })
  })

  it('bug test', async () => {
    const pms = new Promise((resolve) => {
      const sh = spawn('/bin/sh', undefined, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      sh.stdout.on('data', (data) => {
        const dataStr = data.toString()
        console.log(dataStr)
        if (dataStr === 'password') {
          sh.stdin.write(`${process.env.RPASSWORD}\n`)
          sh.stdin.write('whoami;\n')
        } else
          resolve(dataStr)
      })
      sh.on('close', (code) => console.log(`process exited with code ${code}`))
      console.log('SEND SUDO')
      sh.stdin.write('sudo -p password -S su root 2>&1 ;\n')
    })
    const res = await expect(pms).to.be.fulfilled
    console.log(`AWAIT pms DONE: ${res}`)
    // process.exit()
  })

  it('provides a root shell', async () => {
    const rootShell = new ShellHarness({
      user: 'root',
      rootPassword: process.env.RPASSWORD,
    })
    const cmd = await rootShell.createCommand('whoami;')
    console.log(`USER ${cmd.output}`)
    expect(`${cmd.output}`).to.equal('root\n')
    expect(rootShell.config.rootPassword).to.not.exist
    rootShell.close()
  }).timeout(50000)

  it('provides a different user shell', async () => {
    const rootShell = new ShellHarness({
      user: 'testusr',
      rootPassword: process.env.RPASSWORD,
    })
    const cmd = await rootShell.createCommand('whoami;')
    expect(`${cmd.output}`).to.equal('testusr\n')
    expect(rootShell.config.rootPassword).to.not.exist
    rootShell.close()
  })

  it('fails if user does not exist', async () => {
    const rootShell = new ShellHarness({
      user: 'doesNotExist',
      rootPassword: process.env.RPASSWORD,
    })
    await expect(rootShell.createCommand('whoami;')).to.throw
    rootShell.close()
  })

  it('fails if wrong password is provided', async () => {
    const rootShell = new ShellHarness({
      user: 'root',
      rootPassword: 'wrongPassword',
    })
    await expect(rootShell.createCommand('whoami;')).to.throw
    rootShell.close()
  })

  it('can intercept return', async () => {
    const cb1 = async (cmdx, cbData) => {
      expect(cbData).to.equal('HIT')
      return new Promise((resolve) => setTimeout(() => resolve(true, 20)))
    }
    const cmd = await shell.createCommand('printf HELLO ;', 'HIT', cb1)
    expect(cmd).to.be.true

    const cb2 = (cmdy, cbData) => {
      expect(cbData).to.equal('TWO')
      return 'done'
    }
    const cbShell = new ShellHarness({
      doneCallback: cb2,
    })
    const cmd2 = await cbShell.createCommand('printf HELLO ;', 'TWO')
    expect(cmd2).to.equal('done')
    cbShell.close()
  })

  it('receive data via ipc', async () => {
    const cmd = shell.interact(
      'printf "{\\"ipc\\": \\"true\\"}\\n" 1>&$NODE_CHANNEL_FD ; printf HELLO ; \n',
    )
    cmd.on('message', (data) => {
      console.log(data)
      expect(data.ipc).to.equal('true')
      cmd.sendDoneMarker()
    })
    const res = await cmd
    expect(res.output).to.equal('HELLO')
  })
  it('send data via ipc', async () => {
    const cmd = shell.interact('echo ; \n')
    cmd.on('data', (stdout) => {
      console.log(stdout)
      if (stdout === '\n') {
        cmd.sendMessage('HELLOBOB')
        cmd.stdin.write('read -r line <&3 ; printf $line ; \n')
        cmd.sendDoneMarker()
      }
    })
    const res = await cmd
    expect(res.output).to.equal('\n"HELLOBOB"')
  })

  // it('can read streamed file', async () => {
  //   const cmd = shell.interact('echo ; \n')
  //   cmd.on('data', async (stdout) => {
  //     console.log(stdout)
  //     if (stdout === '\n') {
  //       const echoStream = new stream.Readable()
  //       // echoStream._write = (chunk, encoding, done) => {
  //       //   console.log(chunk.toString())
  //       //   done()
  //       //
  //       // }
  //       cmd.pipe(echoStream)
  //       cmd.stdin.write('exec 4<README.md ; \n')
  //       for await (const chunk of echoStream)
  //         console.log(chunk)
  //
  //       cmd.sendDoneMarker()
  //     }
  //   })
  //   const res = await cmd
  //   expect(res.output).to.equal('\n"HELLOBOB"')
  // })

  it('send same command to every queue', async () => {
    const rootShell = new ShellHarness({
      numberOfProcesses: 5,
    })
    let cmds = rootShell.createCommand('echo $$ ;', undefined, undefined, true)
    // expect(cmds.length).to.equal(5)
    const res = await expect(cmds).to.be.fulfilled
    expect(res.length).to.equal(5)
    await rootShell.createCommand('cd /home ;')
    cmds = await rootShell.createCommand('pwd ;', undefined, undefined, true)
    cmds = await rootShell.createCommand('cd / ;', undefined, undefined, true)
    cmds = await rootShell.createCommand('pwd ;', undefined, undefined, true)
    rootShell.close()
  })
})

import ScriptRunner from './script runner'

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const chaiArrays = require('chai-arrays')

chai.use(chaiAsPromised)
chai.use(chaiArrays)

const {expect} = chai

describe('shell queue', () => {
  let shell
  before(async () => {
    shell = new ScriptRunner()
  })
  after(() => shell.close())
  it('send custom command', async () => {
    const cmd = await shell.createCommand('printf HELLO ;')
    expect(cmd.output).to.equal(`HELLO`)
  })
  it('receive data via ipc', async () => {
    const cmd = shell.createCommand(
      'printf "{\\"ipc\\": \\"true\\"}\\n" 1>&$NODE_CHANNEL_FD ; printf HELLO ; \n',
      undefined,
      undefined,
      false
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
    const cmd = shell.createCommand('echo ; \n', undefined, undefined, false)
    cmd.on('data', stdout => {
      console.log(stdout)
      if (stdout === '\n') {
        cmd.sendMessage('HELLO BOB')
        cmd.stdin.write('read -r line <&3 ; printf $line ; \n')
      }
      if (stdout === '\n') {
        cmd.sendDoneMarker()
      }
    })
    const res = await cmd
    expect(res.output).to.equal(`HELLO BOB`)
  })
})

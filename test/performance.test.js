/* eslint-disable no-unused-expressions */

import { execSync } from 'child_process'
import chai from 'chai'
import fs from 'fs'
import ShellHarness from '../src/shell harness.js'

const { expect } = chai

describe('performance tests', () => {
  let shell
  before(async () => {
    shell = new ShellHarness()
  })
  after(() => shell.close())

  it('performance test 1', async () => {
    let cmd
    const maxTimes = 10000
    const start1 = new Date()
    for (let i = 0; i < maxTimes; i++) {
      // eslint-disable-next-line no-await-in-loop
      cmd = await shell.createCommand('printf HELLO ;')
      expect(cmd.output).to.equal('HELLO')
    }
    console.log((new Date() - start1))
    const start2 = new Date()
    for (let i = 0; i < maxTimes; i++) {
      cmd = execSync('printf HELLO ;', undefined)
      expect(cmd.toString()).to.equal('HELLO')
    }
    console.log((new Date() - start2))


    const arrayLoop = [...Array(maxTimes).keys()]
    const start3 = new Date()
    const result = arrayLoop.map(async () => {
      cmd = await shell.createCommand('printf HELLO ;')
      expect(cmd.output).to.equal('HELLO')
    })
    const outcome = await Promise.all(result)
    console.log((new Date() - start3))
  }).timeout(50000)

  it('performance test 2', async () => {
    let cmd
    cmd = await shell.createCommand('whoami;')
    const maxTimes = 10000
    const start1 = new Date()

    for (let i = 0; i < maxTimes; i++) {
      // eslint-disable-next-line no-await-in-loop
      cmd = await shell.createCommand('stat --printf="%d\\0%i\\0%f\\0%h\\0%u\\0%g\\0%d\\0%s\\0%B\\0%b\\0%x\\0%X\\0%y\\0%Y\\0%z\\0%Z\\0%w\\0%W" -- package.json ;')
      // const [
      //   dev,
      //   ino,
      //   mode,
      //   nlink,
      //   uid,
      //   gid,
      //   rdev,
      //   size,
      //   blksize,
      //   blocks,
      //   atimeMs,
      //   mtimeMs,
      //   ctimeMs,
      //   birthtimeMs,
      //   atime,
      //   mtime,
      //   ctime,
      //   birthtime,
      // ] = cmd.output.split('\0')
      // console.log(dev)
    }
    console.log((new Date() - start1))


    const start2 = new Date()
    for (let t = 0; t < maxTimes; t++) {
      // le[ br
      cmd = fs.statSync('package.json')
      expect(cmd.uid).to.equal(1001)
      // expect(cmd.toString()).to.equal('HELLO')
      // console.log(cmd)
    }
    console.log((new Date() - start2))

    const arrr = [...Array(maxTimes).keys()]
    const cmdString = 'stat --printf="%d\\0%i\\0%f\\0%h\\0%u\\0%g\\0%d\\0%s\\0%B\\0%b\\0%x\\0%X\\0%y\\0%Y\\0%z\\0%Z\\0%w\\0%W" -- package.json ;'
    const start3 = new Date()
    const result = arrr.map(async () => {
      cmd = await shell.createCommand(cmdString)
      const [
        dev,
        ino,
        mode,
        nlink,
        uid,
        gid,
        rdev,
        size,
        blksize,
        blocks,
        atimeMs,
        mtimeMs,
        ctimeMs,
        birthtimeMs,
        atime,
        mtime,
        ctime,
        birthtime,
      ] = cmd.output.split('\0')
      expect(uid).to.equal('1001')
    })
    const outcome = await Promise.all(result)
    console.log((new Date() - start3))
  }).timeout(50000)
})

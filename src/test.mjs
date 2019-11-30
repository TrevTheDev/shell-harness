import {spawn} from 'child_process'

const rootF = new Promise(resolve => {
  const sh = spawn('/bin/sh', undefined, {
    stdio: ['pipe', 'pipe', 'pipe']
  })
  sh.stdout.on('data', data => {
    const dataStr = data.toString()
    console.log(dataStr)
    if (dataStr === 'password') {
      sh.stdin.write(`${process.env.RPASSWORD}\n`)
      sh.stdin.write('whoami;\n')
      sh.stdin.write('exit;\n')
      sh.stdin.write('whoami;\n')
    } else {
      resolve(dataStr)
    }
  })
  sh.on('close', code => console.log(`process exited with code ${code}`))
  sh.stdin.write('sudo -p password -S su root 2>&1 ;\n')
  console.log('SUDO SENT')
})

;(async () => {
  console.log('BEFORE')
  await rootF
  console.log('AFTER')
  process.exit()
})()

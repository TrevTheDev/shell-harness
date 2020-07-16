# Introduction

Shell Harness provides an easy way to interact with shell commands and scripts. Benefits:

- an initial script can be run to set context for all subsequent commands
- all commands run in a long-running Child Processes vs. a Child Processes for each command.  This can be significantly faster than spawning new processes for each command.  36 times faster in one benchmark.
- Multiple shells can be spawned to run commands in parallel
- Commands are queued in a FIFO manner

# Installation

```bash
npm install @trevthedev/shell-harness
```

# How To

## Launch a shell(s)

```javascript
import ShellHarness from '@trevthedev/shell-harness'
const shell = new ShellHarness()
```

## Send a command

```javascript
const cmd = await shell.createCommand('printf HELLO ;')
console.log(cmd.output) // HELLO
```

All shell commands or scripts must terminate with a semi-colon ;

All stderr output is redirected to stdout via 2>&1 and not command should send data to stderr (required as Node does not process stdout and stderr sequentially)

## Send a command to all shells

```javascript
const cmd = await shell.createCommand('cd / ;', undefined, undefined, true)
```

returns a promise that will resolve once the command has been executed on all shells ;

## Interact with the shell

```javascript
const cmdline = shell.interact('echo "what is your name?" ; read name;\n')
cmdline.on('data', stdout => {
  if (stdout === 'what is your name?\n') {
    cmdline.stdin.write('Bob\necho $name\n ')
    cmdline.sendDoneMarker() // required to indicate that this interaction is completed
  } else {
    console.log(stdout) // `Bob\n`
  }
})
const outcome = await cmdline
console.log(outcome.output) // `what is your name?\nBob\n`
```

## Get a root or other user shell

```javascript
const rootShell = new ShellHarness({
  user: 'root', // or other user
  rootPassword: process.env.RPASSWORD
})
const cmd = await rootShell.createCommand('whoami;')
console.log(cmd.output) // 'root\n'
console.log(rootShell.config.rootPassword) // undefined
```

This will switch to another user via sudo and a sudo'er password is required - unfortunately shell does not allow one to su without sudo.

## Intercept and replace output

The output from a command can be intercepted in two ways and different result substituted if required.

```javascript
const cb = (cmdX, cbData) => {
  console.log(cbData) // 'HIT'
  return true
}
const cmd = await shell.createCommand('printf HELLO ;', 'HIT', cb)
console.log(cmd) // true
```

or

```javascript
const cb = (cmdX, cbData) => {
  console.log(cbData) // 'HIT'
  return true
}
const cbShell = new ShellHarness({
  doneCallback: cb
})
const cmd = await cbShell.createCommand('printf HELLO ;', 'HIT')
console.log(cmd) // true
cbShell.close()
```

## Receive data via IPC

```javascript
const cmd = shell.interact(
  'printf "{\\"ipc\\": \\"true\\"}\\n" 1>&$NODE_CHANNEL_FD ; printf HELLO ; \n'
)
cmd.on('message', data => {
  console.log(data) // { ipc: "true" }
  cmd.sendDoneMarker() // required to finished command
})
const res = await cmd
console.log(res.output) // `HELLO`
```

## Send data via IPC

```javascript
const cmd = shell.interact('echo ; \n')
cmd.on('data', stdout => {
  if (stdout === '\n') {
    cmd.sendMessage('HELLOBOB')
    cmd.stdin.write('read -r line <&3 ; printf $line ; \n')
  } else cmd.sendDoneMarker() // required to finished command
})
const res = await cmd
console.log(res.output) // \n"HELLOBOB"`
```

Node formats messages sent via IPC

# Configuration

```javascript
{
  shell: '/bin/sh',        // shell to use
  initScript: undefined,   // script to run when shell is first launched

  doneCallback: undefined, // callback before any command is completed

  user: undefined,         // user to switch to via sudo then su
  rootPassword: undefined, // root password to switch user

  numberOfProcesses: 1,    // number of shells to spawn
  concurrentCmds: 100,     // max number of commands to send to the shell at a time per shell

  doneMarker: '__done__',  // unique identifier to determine whether command is completed - a sequential number is also added

  log: true                // produce a log
}
```

# API

```javascript
const shell = new ShellHarness(optionalConfig)

const cmd = shell.createCommand(
  command,
  optionalDoneCallBackPayload,
  optionalDoneCallback,
  sendToEveryShell
)

const cmd = shell.interact(
  command,
  optionalDoneCallBackPayload,
  optionalDoneCallback
)

cmd.on('data', data => {})
cmd.on('message', message => {})

// other events include: created, enqueued, executing, cancelled, failed and finished

const result = await cmd
// result = {
//  error: whether shell exited in error,
//  command: the command sent,
//  output: string result }
```

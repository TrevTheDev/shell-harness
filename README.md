# Introduction

Shell Harness provides an easy way to interact with shell commands and scripts.  Benefits:

 - An initial script can be run to set context for all subsequent commands
 - All commands are run in the same process vs. a process for each command
 - Multiple shells can be spawned to run commands in parallel
 - Commands are queued in a FIFO manner

# Installation

npm install shell-harness

# How To

## Launch a shell(s)

    import ShellHarness from 'shell-harness'
    shell = new ShellHarness()

## Send a command

    const cmd = await shell.createCommand('printf HELLO ;')
    console.log(cmd.output) // HELLO

All shell commands or scripts must terminate with a ;
All stderr output is redirected to stdout via 2>&1 (hack required as Node does not process stdout and stderr sequentially)

## Interact with the shell
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
  })

## Get a root or other user shell
    const rootShell = new ShellHarness({
      user: 'root',  // or other user
      rootPassword: process.env.RPASSWORD
    })
    const cmd = await rootShell.createCommand('whoami;')
    console.log(cmd.output) // 'root\n'
    console.log(rootShell.config.rootPassword) // undefined

This will switch to another user via sudo and a sudo'er password is required - unfortunately su doesn't work like sudo.

## Intercept and replace output
The output from a command can be intercepted in two ways and different result substituted if required.
     
    const cb = (cmdX, cbData) => {
      console.log(cbData) // 'HIT'
      return true
    }
    const cmd = await shell.createCommand('printf HELLO ;', 'HIT', cb)
    console.log(cmd) // true

or

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

## Receive data via IPC

    const cmd = shell.interact(
      'printf "{\\"ipc\\": \\"true\\"}\\n" 1>&$NODE_CHANNEL_FD ; printf HELLO ; \n'
    )
    cmd.on('message', data => {
      console.log(data) // { ipc: "true" }
      cmd.sendDoneMarker()
    })
    const res = await cmd
    console.log(res.output) // `HELLO`

## Send data via IPC

    const cmd = shell.interact('echo ; \n')
    cmd.on('data', stdout => {
      if (stdout === '\n') {
        cmd.sendMessage('HELLOBOB')
        cmd.stdin.write('read -r line <&3 ; printf $line ; \n')
      }
        cmd.sendDoneMarker()
      }
    })
    const res = await cmd
    console.log(res.output) // \n"HELLOBOB"`

Node formats messages sent via IPC


# Configuration

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

# API
    const shell = new ShellHarness(optionalConfig)

    const cmd = shell.createCommand(command, optionalDoneCallBackPayload, optionalDoneCallback)

    cmd.on('data', data=>{})
    cmd.on('message', message=>{})

    // other events include: created, enqueued, executing, cancelled and finished

    const result = await cmd
    // result = { 
    //  error: whether shell exited in error,
    //  command: the command sent, 
    //  output: string result }



# WSL Terminal Commands Workaround

## Problem
When the workspace is a WSL path (e.g., `\\wsl.localhost\Ubuntu-24.04\...`), running commands directly with UNC paths fails:
```
UNC paths are not supported. Defaulting to Windows directory.
```

## Solution
Use `wsl -d <distro> bash -c "<command>"` to run commands in WSL from Windows CMD.

## Command Template
```bash
wsl -d Ubuntu-24.04 bash -c "cd /home/stfox/completed-fl/frontend-nuxt-4-active && <your-command>"
```

## Examples

### Check Node.js version
```bash
wsl -d Ubuntu-24.04 bash -c "cd /home/stfox/completed-fl/frontend-nuxt-4-active && node --version"
```

### Install npm packages
```bash
wsl -d Ubuntu-24.04 bash -c "cd /home/stfox/completed-fl/frontend-nuxt-4-active && npm install socket.io-client mediasoup-client"
```

### Run dev server
```bash
wsl -d Ubuntu-24.04 bash -c "cd /home/stfox/completed-fl/frontend-nuxt-4-active && npm run dev"
```

### Run tests
```bash
wsl -d Ubuntu-24.04 bash -c "cd /home/stfox/completed-fl/frontend-nuxt-4-active && npm test"
```

## Key Points
1. Use `C:\` or `C:\Users\stfox` as the `Cwd` for the run_command tool (NOT the WSL UNC path)
2. WSL distro name is `Ubuntu-24.04`
3. Project path inside WSL is `/home/stfox/completed-fl/frontend-nuxt-4-active`
4. Chain commands with `&&` inside the bash -c string

import { spawn } from "node:child_process";
const input=process.argv.slice(2),args=[];
for(let i=0;i<input.length;i++){
 if(input[i]==="--strictPort")continue; // Next rejects an occupied explicit --port.
 if(input[i]==="--host"){args.push("--hostname",input[++i]??"0.0.0.0");continue;}
 args.push(input[i]);
}
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","dev",...args],{stdio:"inherit",env:process.env});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("exit",(code,signal)=>{if(signal)process.kill(process.pid,signal);else process.exitCode=code??1;});

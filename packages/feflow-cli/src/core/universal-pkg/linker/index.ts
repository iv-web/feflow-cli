import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * link your code to system commands
 */
export default class Linker {
    
    private currentOs: NodeJS.Platform;

    private startCommand: string = 'fef';

    private fileMode = 0o744;

    constructor(startCommand?: string) {
        this.currentOs = os.platform();
        startCommand && (this.startCommand = startCommand);
    }

    register(binPath: string, libPath: string, command: string) {
        this.enableDir(binPath, libPath);
        if (this.currentOs === 'win32') {
            this.linkToWin32(binPath, command);
        } else {
            this.linkToUnixLike(binPath, libPath, command);
        }
    }

    private linkToWin32(binPath: string, command: string) {
        const file = this.cmdFile(binPath, command);
        const template = this.cmdTemplate(command);
        this.writeExecFile(file, template);
    }

    private linkToUnixLike(binPath: string, libPath: string, command: string) {
        this.enableLibPath(libPath);
        const file = this.shellFile(libPath, command);
        const template = this.shellTemplate(command);
        const commandLink = path.join(binPath, command);
        this.writeExecFile(file, template);
        if (fs.existsSync(commandLink) && fs.statSync(commandLink).isSymbolicLink) {
            return
        }
        fs.symlinkSync(file, commandLink);
    }

    private enableLibPath(path: string) {
        if (fs.existsSync(path) && fs.statSync(path).isFile()) {
            fs.unlinkSync(path);
        }

        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    }

    private writeExecFile(file: string, content: string) {
        const exists = fs.existsSync(file);
        if (exists) {
            try {
                fs.accessSync(file, fs.constants.X_OK);
            } catch(e) {
                fs.chmodSync(file, this.fileMode);
            }
        } 
        fs.writeFileSync(file, content, {
            mode: this.fileMode,
            flag: 'w',
            encoding: 'utf8'
        });
    }

    private shellTemplate(command: string): string {
        return `#!/bin/sh\n${this.startCommand} ${command} $@`;
    }

    private cmdTemplate(command: string): string {
        return `@echo off\n${this.startCommand} ${command} %*`;
    }

    private shellFile(libPath: string, name: string): string {
        return path.join(libPath, `${name}.sh`);
    }

    private cmdFile(binPath: string, name: string): string {
        return path.join(binPath, `${name}.cmd`)
    }

    private enableDir(...dirs: string[]) {
        if (!dirs) {
            return;
        }
        dirs.forEach(d => {
            if (fs.existsSync(d) && fs.statSync(d).isFile()) {
                fs.unlinkSync(d);
            }
    
            if (!fs.existsSync(d)) {
                fs.mkdirSync(d, { recursive: true });
            }
        });
    }

}
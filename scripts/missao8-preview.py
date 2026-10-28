import os,subprocess,pathlib,sys,socket
root=pathlib.Path(__file__).resolve().parents[1]
settings=dict(line.split('=',1) for line in (root/'.env').read_text().splitlines() if '=' in line)
assert settings['PORT']=='5019'
assert '@127.0.0.1:5437/uppulse_missao8' in settings['DATABASE_URL']
env={k:v for k,v in os.environ.items() if not any(x in k.upper() for x in ['DATABASE','SECRET','TOKEN','PASSWORD','PUBLIC_DEMO','REPL_ID'])}
env.update(settings)
try:
    connection=socket.create_connection(('127.0.0.1',5019),timeout=1)
except OSError:
    pass
else:
    connection.close();print('Porta 5019 já está em uso; nenhuma instância iniciada.');sys.exit(0)
log=open(root.parent/'preview.log','a')
compiled='--built' in sys.argv
command=['node','dist/index.js'] if compiled else ['node','--import','tsx','server/index-dev.ts']
proc=subprocess.Popen(command,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
(root.parent/'preview.pid').write_text(str(proc.pid))
print('Preview independente iniciado, PID',proc.pid)

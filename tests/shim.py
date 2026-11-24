# 测试用：模拟 Supabase 的 /rest/v1/rpc/<函数>（以 anon 角色调用数据库函数），并提供静态网页
import json, http.server, psycopg2, os, sys
ROOT=sys.argv[1]
def call(fn,args):
    c=psycopg2.connect(host='/tmp/pg',port=5444,user='postgres',dbname=os.environ.get('PGDB','postgres'));c.autocommit=True;cur=c.cursor()
    cur.execute('set role anon')
    names=list(args.keys());sql=f"select {fn}({','.join(n+':=%s' for n in names)})"
    vals=[json.dumps(v) if isinstance(v,(dict,list)) else v for v in args.values()]
    try:cur.execute(sql,vals);r=cur.fetchone()[0];return 200,('' if r is None else json.dumps(r))
    except Exception as e:return 400,json.dumps({'message':str(e).split('\n')[0]})
    finally:c.close()
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k):super().__init__(*a,directory=ROOT,**k)
    def log_message(s,*a):pass
    def do_POST(s):
        if s.path.startswith('/rest/v1/rpc/'):
            fn=s.path.split('/')[-1];n=int(s.headers.get('Content-Length',0));args=json.loads(s.rfile.read(n) or b'{}')
            code,body=call(fn,args);b=body.encode();s.send_response(code);s.send_header('Content-Type','application/json');s.send_header('Content-Length',str(len(b)));s.end_headers();s.wfile.write(b)
        else:s.send_response(404);s.end_headers()
http.server.ThreadingHTTPServer(('',8766),H).serve_forever()

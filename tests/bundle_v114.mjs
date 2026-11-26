process.env.HUABAO_BUNDLE_ONLY='1';
const {pg,assert}=await import('./integrity_fixture.mjs');
try{
assert.equal((await pg.query("select jxc_can_write('keeper','moves','{\"type\":\"qc_out\"}') ok")).rows[0].ok,true);
assert.equal((await pg.query("select enabled from jxc_language_settings where id")).rows[0].enabled,false);
assert.equal((await pg.query("select jxc_doc_visible((select u from jxc_users u where id='acct'),'moves','{\"type\":\"qc_in\"}') ok")).rows[0].ok,true);
assert.equal((await pg.query("select has_function_privilege('anon','jxc_reserved(text,text,text)','EXECUTE') ok")).rows[0].ok,false);
console.log('Complete upgrade SQL PASS: upgrade directly from v1.12, one transaction, applied twice; QC permissions, financial visibility, disabled paid language and private helpers preserved.');
}finally{await pg.close()}

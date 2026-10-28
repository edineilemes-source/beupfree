import 'dotenv/config';
import pg from 'pg';
import {processIdentityJob} from '../server/productIdentity/jobs';
const url=new URL(process.env.MASTER_DATABASE_URL!);
if(url.hostname!=='127.0.0.1'||url.port!=='5436'||url.pathname!=='/uppulse_missao7')throw Error('DISPOSABLE_DATABASE_REQUIRED');
const pool=new pg.Pool({connectionString:url.toString()});
try{
 const jobId=process.argv[2];if(!jobId)throw Error('EXPLICIT_JOB_ID_REQUIRED');
 console.log(JSON.stringify(await processIdentityJob(pool,jobId,Number(process.argv[3]??1))));
}finally{await pool.end();}

import {Router} from 'express';
import pg from 'pg';
import {readMaster} from './reader';
export function createMasterIdentityRouter(){
 const router=Router();let pool:pg.Pool|undefined;
 router.get('/:productId',async(req,res)=>{
  if(process.env.MASTER_IDENTITY_ENABLED!=='true')return res.status(404).json({code:'DISABLED'});
  try{pool??=new pg.Pool({connectionString:process.env.MASTER_DATABASE_URL,max:3,statement_timeout:5000});
   const db=await pool.connect();let data;
   try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    data=await readMaster(db as any,req.params.productId);await db.query('COMMIT');
   }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
   return res.json({status:data?'AVAILABLE':'NO_CONFIRMED_IDENTITY',...data});
  }catch{return res.status(503).json({code:'IDENTITY_UNAVAILABLE'});}
 });
 return router;
}

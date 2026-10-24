import{requirePolicySync}from'../../scripts/lib/require-policy-sync';
requirePolicySync({ledgerPath:process.argv[2],basisFile:process.argv[3],allowedTypes:['policy_release']}).catch(error=>{console.error(error);process.exitCode=1});

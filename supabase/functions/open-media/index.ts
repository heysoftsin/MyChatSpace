import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async req => {
  try {
    const auth=req.headers.get('Authorization');
    if(!auth)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401});
    const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await userClient.auth.getUser();
    if(!user)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401});
    const {media_id}=await req.json();
    const {data:r,error}=await userClient.rpc('consume_media_view',{media_id_input:media_id});
    if(error)throw error;
    if(!r?.path)return new Response(JSON.stringify({url:null,remaining:r?.remaining??0}),{headers:{'Content-Type':'application/json'}});
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:signed,error:se}=await admin.storage.from('chat-media').createSignedUrl(r.path,60);
    if(se)throw se;
    return new Response(JSON.stringify({url:signed.signedUrl,remaining:r.remaining,media_type:r.media_type}),{headers:{'Content-Type':'application/json'}});
  }catch(e){return new Response(JSON.stringify({error:e?.message||'Unable to open media'}),{status:400,headers:{'Content-Type':'application/json'}})}
});

import BentovModule from '@/components/bentov/BentovModule';
export default function RespirationAttentionPage(){
 const origins=process.env.BASE60_BRIDGE_ENABLED==='true'?(process.env.BASE60_BRIDGE_ORIGINS??'').split(',').map(s=>s.trim()).filter(s=>{try{const u=new URL(s);return u.protocol==='https:'&&u.origin===s;}catch{return false;}}):[];
 return <BentovModule base60Origins={origins}/>;
}

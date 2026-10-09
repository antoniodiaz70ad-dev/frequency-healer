export interface PitchResult { frequencyHz:number; confidence:number; rms:number; }

/** Normalized autocorrelation pitch detector. Input is analyzed locally and never retained. */
export function detectPitch(samples:Float32Array,sampleRate:number,minHz=80,maxHz=1200):PitchResult|null {
  if(samples.length<256||!Number.isFinite(sampleRate)||sampleRate<=0)return null;
  let mean=0;for(const value of samples)mean+=value;mean/=samples.length;
  let energy=0;for(const value of samples){const centered=value-mean;energy+=centered*centered;}const rms=Math.sqrt(energy/samples.length);
  if(rms<.008)return null;
  const minLag=Math.max(2,Math.floor(sampleRate/maxHz)),maxLag=Math.min(samples.length>>1,Math.ceil(sampleRate/minHz));
  let bestLag=0,best=-1;const scores:number[]=[];
  for(let lag=minLag;lag<=maxLag;lag++){
    let cross=0,a2=0,b2=0;const length=samples.length-lag;
    for(let i=0;i<length;i++){const a=samples[i]-mean,b=samples[i+lag]-mean;cross+=a*b;a2+=a*a;b2+=b*b;}
    const score=cross/Math.sqrt(a2*b2||1);
    scores[lag]=score;if(score>best){best=score;bestLag=lag;}
  }
  // The first strong local maximum is the fundamental period; later equal peaks are multiples.
  for(let lag=minLag+1;lag<maxLag;lag++)if(scores[lag]>.8&&scores[lag]>=scores[lag-1]&&scores[lag]>scores[lag+1]){bestLag=lag;best=scores[lag];break;}
  if(best<.72||bestLag===0)return null;
  const correlation=(lag:number)=>{let cross=0,a2=0,b2=0;for(let i=0;i<samples.length-lag;i++){const a=samples[i]-mean,b=samples[i+lag]-mean;cross+=a*b;a2+=a*a;b2+=b*b;}return cross/Math.sqrt(a2*b2||1);};
  const left=correlation(Math.max(minLag,bestLag-1)),right=correlation(Math.min(maxLag,bestLag+1)),denominator=2*(2*best-left-right),offset=Math.abs(denominator)>1e-9?(right-left)/denominator:0,lag=bestLag+Math.max(-.5,Math.min(.5,offset));
  const frequencyHz=sampleRate/lag;
  return frequencyHz>=minHz&&frequencyHz<=maxHz?{frequencyHz,confidence:best,rms}:null;
}

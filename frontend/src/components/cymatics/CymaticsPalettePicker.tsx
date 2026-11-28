import {useId} from 'react';
import {paletteNames,palettes,type CymaticsPalette} from '@/lib/cymatics/palettes';
import styles from './cymatics.module.css';

export default function CymaticsPalettePicker({value,onChange}:{value:CymaticsPalette;onChange:(color:CymaticsPalette)=>void}) {
  const group=useId();
  return <fieldset className={styles.palettePicker}><legend>Color de la figura</legend><div>
    {(Object.keys(paletteNames) as CymaticsPalette[]).map(key=><label key={key}>
      <input type="radio" name={group} checked={key===value} onChange={()=>onChange(key)}/>
      <i aria-hidden="true" style={{background:palettes[key].field}}/>{paletteNames[key]}
    </label>)}
  </div></fieldset>;
}

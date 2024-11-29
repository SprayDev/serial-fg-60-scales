import Scales, {ScalesOptions} from "./classes/Scales";

declare global {
  interface Window {
    SerialScales: any;
  }
}

const defineSerialScale = (options: ScalesOptions): Scales => {

  if (window.SerialScales){
    return window.SerialScales
  }

  const scales = new Scales(options)

  window.SerialScales = scales

  return scales
}

export default defineSerialScale;

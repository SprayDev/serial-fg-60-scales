const connectSerialPort = (port: SerialPort) => {

}

const getAllSerialPorts = async (): Promise<SerialPort[]> => {
  return await navigator.serial.getPorts()
}

const requestPort = async (): Promise<SerialPort | undefined> => {
  try {
    return await navigator.serial.requestPort();
  } catch (e) {
    console.error(e)
    return undefined
  }
}

const openPort = async (port: SerialPort, options: SerialOptions): Promise<boolean> => {
  try {
    await port.open(options)
    return true
  } catch (e) {
    console.error(e)
    return false
  }
}

async function listenPort(port: SerialPort, onSuccessRead: (reader: any) => void, listener: (message: string) => void) {
  let reader
  try {
    const decoder = new TextDecoder();
    reader = port.readable?.getReader();

    if (!reader){
      throw new Error(`Cant read serial port`)
    }

    onSuccessRead(reader)

    let buffer = ''; // Temporary storage for incoming data chunks

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // Stop reading
        break;
      }
      if (value) {
        // Decode and accumulate the incoming data
        buffer += decoder.decode(value);

        // Check if a complete message has been received (ends with CR LF)
        while (buffer.includes('\r\n')) {
          // Extract a single message up to the delimiter
          const [message, ...rest] = buffer.split('\r\n');
          buffer = rest.join('\r\n'); // Save the remaining data in the buffer

          listener(message)
        }
      }
    }
  } catch (err) {
    console.error('Error reading from the serial port:', err);
  } finally {
    if (reader) {
      reader.releaseLock();
    }
  }
}


export {
  getAllSerialPorts,
  requestPort,
  openPort,
  listenPort
}

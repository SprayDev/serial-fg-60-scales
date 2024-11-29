import {getAllSerialPorts, openPort, requestPort, listenPort} from "../utils/serial-port";

export type ScalesOptions = {
  serialOptions?: SerialOptions,
  rememberLast: boolean,
  portConnected?: (port: SerialPort) => void,
  messageReceived?: (message: MessageData | undefined, sourceMessage: string) => void
}

export enum SerialScaleCommands {
  REQUEST_DATA = 'Q',
  RE_ZERO = 'Z'
}

export enum MessageHeader {
  STABLE_WEIGHT = 'ST',
  STABLE_COUNT = 'QT',
  UNSTABLE_DATA = 'US',
  OVER = 'OL'
}

export enum MessageUnit {
  WEIGHT_KG = 'kg',
  COUNT_PCS = 'PC',
  WEIGHT_POUND = 'lb',
  WEIGHT_OUNCE = 'oz'
}

type OperandType = '+' | '-'

export type MessageData = {
  header: MessageHeader
  unit: MessageUnit
  value: number
  operand: OperandType
}


export default class Scales {
  public serialPort: SerialPort | undefined

  private portWriter: WritableStreamDefaultWriter | undefined
  private portReader: any
  constructor(private readonly options: ScalesOptions) {
    // check if serial ports support via browser
    if (!("serial" in navigator)){
      throw new Error('Serial port is not supported with this browser')
    }

    let serialOptions: SerialOptions | undefined = options.serialOptions

    if (!serialOptions?.baudRate){
      serialOptions = this.defaultSerialOptions
    }

    if (options.rememberLast){
      this.connectScaleFromPrevTime()
    }
  }

  async connectScaleFromPrevTime(){
    const serialOptions = this.serialOptions
    let port: SerialPort | undefined = undefined

    const pairedPorts = await this.getPairedPorts()

    if (this.options.rememberLast && pairedPorts.length === 1){
      port = pairedPorts.at(0)
    }

    if (!port){
      return undefined
    }

    await this.connect(port, serialOptions)
  }

  async sendCommand(command: SerialScaleCommands){
    const writer = this.portWriter
    if (writer) {
      try {
        // Convert the command to Uint8Array with proper encoding
        const encoder = new TextEncoder();
        const data = encoder.encode(command + '\r\n'); // Add CR LF at the end

        // Write the command to the scales
        await writer.write(data);
        console.log('Command sent:', command);
      } catch (err) {
        console.error('Error writing to the serial port:', err);
      }
    } else {
      console.warn('No writer available. Make sure you are connected to the port.');
    }
  }

  async connectScale(){
    const serialOptions = this.serialOptions
    // get port from requesting or if rememberLast is true and there is 1 port in getPairedPorts (if more than 1 need request)
    let port: SerialPort | undefined = undefined

    port = await requestPort()

    if (!port) {
      // error, cant connect to port
      throw new Error(`Cant connect serial port`)
    }

    await this.connect(port, serialOptions)
  }

  private async connect(port: SerialPort, options: SerialOptions){
    await this.openPort(port, options)

    console.info('Listening port:', port.getInfo())
    this.serialPort = port

    if (this.options.portConnected){
      this.options.portConnected(port)
    }

    // save writer and listen port for data
    this.portWriter = port.writable?.getWriter();

    // listen port for data
    await this.readFromPort(port)
  }

  private async readFromPort(port: SerialPort){
    await listenPort(port, (reader) => {
      this.portReader = reader
    }, (message: string) => {
      console.log('message', message)

      const messageData = this.processScalesData(message)

      if (!this.options?.messageReceived){
        return;
      }

      this.options.messageReceived(messageData, message)
    })
  }

  async disconnect(){
    if (this.portReader) {
      console.log('release reader')
      await this.portReader.cancel();
      this.portReader.releaseLock();
    }

    if (this.portWriter) {
      console.log('release writer')
      this.portWriter.releaseLock();
    }

    if (this.serialPort) {
      console.log('release port')
      await this.serialPort.close();
      console.log('Disconnected from the serial port');
    }
  }

  async openPort(port: SerialPort, options: SerialOptions): Promise<void>{
    const opened = await openPort(port, options)

    if (!opened){
      throw new Error(`Cant open port for listening`)
    }
  }

  async getPairedPorts(){
    return getAllSerialPorts()
  }

  private processScalesData(sourceMessage: string): MessageData | undefined {
    // Parse and handle the data received from the scales
    sourceMessage = sourceMessage.trim()

    // check for reg ex
    // @ts-ignore
    const scalesRegEx = /(?<header>ST|QT|US|OL),(?<operand>[+\-])(?<value>\d{5}\.\d{2})\s(?<unit>kg|PC|lb|pz)/
    if (!scalesRegEx.test(sourceMessage)){
      console.warn('Invalid source message: ', sourceMessage)
      return undefined
    }

    const regexMatch = sourceMessage.match(scalesRegEx)

    if (!regexMatch){
      console.warn('Invalid source message: ', sourceMessage)
      return undefined
    }

    const { groups } = regexMatch

    const header: MessageHeader = groups?.header as MessageHeader
    const unit: MessageUnit = groups?.unit as MessageUnit
    const operand: OperandType = groups?.operand as OperandType

    let value: number = Number(groups?.value)

    if (operand === '-'){
      value *= -1
    }

    return {
      header,
      unit,
      value,
      operand
    }
  }

  get serialOptions(){
    return this.options.serialOptions || this.defaultSerialOptions
  }

  get isPortOpened(): boolean{
    return !!this.serialPort
  }
  get defaultSerialOptions(): SerialOptions {
    return {
      baudRate: 9600,
      dataBits: 7,
      parity: "even",
      stopBits: 1,
    }
  }
}

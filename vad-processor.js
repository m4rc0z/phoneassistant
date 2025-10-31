// vad-processor.js
class VadProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.isSpeaking = false;
        this.silentChunkCount = 0;
        // Assuming 48000 sampleRate and 128 samples per chunk, process is called ~375 times/sec.
        // 1500ms timeout = 1.5 * 375 = ~563 silent chunks.
        this.SILENT_CHUNKS_THRESHOLD = 563;
        this.VAD_THRESHOLD = 0.01; // Threshold for raw float audio samples (-1 to 1)
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const samples = input[0];
            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
                sum += Math.abs(samples[i]);
            }
            const average = sum / samples.length;

            if (average > this.VAD_THRESHOLD) { // Speech detected
                if (!this.isSpeaking) {
                    this.isSpeaking = true;
                    this.port.postMessage({ event: 'speechStart' });
                }
                this.silentChunkCount = 0; // Reset silence counter
            } else if (this.isSpeaking) { // Silence after speech
                this.silentChunkCount++;
                if (this.silentChunkCount > this.SILENT_CHUNKS_THRESHOLD) {
                    this.port.postMessage({ event: 'silence' });
                    this.isSpeaking = false;
                    this.silentChunkCount = 0;
                }
            }
        }
        return true; // Keep processor alive
    }
}

registerProcessor('vad-processor', VadProcessor);
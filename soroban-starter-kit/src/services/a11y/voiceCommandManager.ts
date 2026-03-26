/**
 * Voice Command Manager
 * Handles voice commands and speech recognition
 */

export interface VoiceCommand {
  phrase: string;
  action: () => void;
  description: string;
}

export interface VoiceConfig {
  enabled: boolean;
  language: string;
  continuous: boolean;
  interimResults: boolean;
}

class VoiceCommandManager {
  private recognition: SpeechRecognition | null = null;
  private commands: Map<string, VoiceCommand> = new Map();
  private config: VoiceConfig = {
    enabled: false,
    language: 'en-US',
    continuous: false,
    interimResults: true,
  };

  private isListening = false;
  private listeners: Set<(transcript: string) => void> = new Set();

  constructor() {
    this.initSpeechRecognition();
  }

  /**
   * Initialize speech recognition
   */
  private initSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.language = this.config.language;

    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
  }

  /**
   * Register voice command
   */
  registerCommand(phrase: string, action: () => void, description: string): void {
    this.commands.set(phrase.toLowerCase(), { phrase, action, description });
  }

  /**
   * Start listening
   */
  startListening(): void {
    if (!this.recognition || this.isListening) return;
    this.isListening = true;
    this.recognition.start();
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (!this.recognition || !this.isListening) return;
    this.isListening = false;
    this.recognition.stop();
  }

  /**
   * Handle speech recognition result
   */
  private handleResult(event: SpeechRecognitionEvent): void {
    let transcript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }

    this.notifyListeners(transcript);
    this.executeCommand(transcript);
  }

  /**
   * Execute voice command
   */
  private executeCommand(transcript: string): void {
    const normalized = transcript.toLowerCase().trim();

    for (const [phrase, command] of this.commands) {
      if (normalized.includes(phrase)) {
        command.action();
        break;
      }
    }
  }

  /**
   * Subscribe to voice input
   */
  subscribe(listener: (transcript: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(transcript: string): void {
    this.listeners.forEach(listener => listener(transcript));
  }

  /**
   * Get available commands
   */
  getCommands(): VoiceCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Check if voice recognition is available
   */
  isAvailable(): boolean {
    return this.recognition !== null;
  }

  /**
   * Check if currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }
}

export const voiceCommandManager = new VoiceCommandManager();
export default voiceCommandManager;

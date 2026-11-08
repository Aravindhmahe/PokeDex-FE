import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  afterNextRender,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';

// ==========================================
// Interfaces matching FastAPI & Tool Outputs
// ==========================================

export interface PokemonStats {
  hp: number;
  height: number;
  weight: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
}

export interface PokemonCardData {
  image: string;
  pokemon_name: string;
  japanese_name: string;
  genera: string;
  evolution_chain: string;
  audio_cries?: string | null;
  stats: PokemonStats;
}

export interface ChatApiResponse {
  status: number;
  session_id: string;
  response: {
    pokemon_card: PokemonCardData[];
    description: string;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
  pokemonCards: PokemonCardData[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./app.html",
  styleUrls:["./app.scss"],
})
export class App {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);

  // Signal State Management
  sessionId = signal<string>(crypto.randomUUID());
  messages = signal<ChatMessage[]>([]);
  currentInput = signal<string>('');
  loading = signal<boolean>(false);
  isDarkMode = signal<boolean>(false);
  sidebarOpen = signal<boolean>(true);
  currentlyPlayingAudio = signal<string | null>(null);

  // Quick Prompt Chips
  suggestedPrompts = [
    'Tell me about Pikachu',
    'What are Charizard base stats?',
    'Show Gengar evolutions',
    'Compare Mewtwo and Lucario'
  ];

  constructor() {
    // Enable smooth auto-scroll when new messages land
    afterNextRender(() => {
      this.scrollToBottom();
    });
  }

  toggleTheme() {
    this.isDarkMode.update(v => !v);
  }

  resetSession() {
    this.sessionId.set(crypto.randomUUID());
    this.messages.set([]);
  }

  useSuggestedPrompt(promptText: string) {
    this.currentInput.set(promptText);
    this.sendMessage();
  }

  sendMessage() {
    const query = this.currentInput().trim();
    if (!query || this.loading()) return;

    // 1. Push user message locally
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: query,
      timestamp: new Date(),
      pokemonCards: []
    };

    this.messages.update(prev => [...prev, userMsg]);
    this.currentInput.set('');
    this.loading.set(true);
    this.scrollToBottom();

    // 2. Dispatch query to FastAPI backend with fallback mock data
    this.http.post<ChatApiResponse>('http://localhost:8000/getPokemonDetails', {
      user_query: query,
      session_id: this.sessionId()
    }).subscribe({
      next: (response) => {
        this.handleApiResponse(response);
      },
      error: () => {
        // Fallback demo response if backend is offline/unreachable
        const mockResponse: ChatApiResponse = {
          status: 200,
          session_id: this.sessionId(),
          response: {
            description: `Pikachu is an Electric-type Mouse Pokémon. It stores electricity in its cheek sacs and releases powerful electrical discharges when threatened.`,
            pokemon_card: [{
              image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
              pokemon_name: 'Pikachu',
              japanese_name: 'ピカチュウ',
              genera: 'Mouse Pokémon',
              evolution_chain: 'Pichu → Pikachu → Raichu',
              audio_cries: 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg',
              stats: {
                hp: 35,
                height: 0.4,
                weight: 6.0,
                attack: 55,
                defense: 40,
                special_attack: 50,
                special_defense: 50,
                speed: 90
              }
            }]
          },
        };

        // Simulating slight delay for fallback
        setTimeout(() => {
          this.handleApiResponse(mockResponse);
        }, 800);
      }
    });
  }

  private handleApiResponse(response: ChatApiResponse) {
    this.sessionId.set(response.session_id);

    const agentMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'agent',
      text: response.response.description,
      timestamp: new Date(),
      pokemonCards: response.response.pokemon_card
    };

    this.messages.update(prev => [...prev, agentMsg]);
    this.loading.set(false);
    this.scrollToBottom();
  }

  playCry(audioUrl: string) {
    if (!audioUrl) return;

    this.currentlyPlayingAudio.set(audioUrl);
    const audio = new Audio(audioUrl);

    audio.play().catch(err => console.error('Audio play error:', err));

    audio.onended = () => {
      this.currentlyPlayingAudio.set(null);
    };
  }

  getStatPercentage(statValue: number): number {
    // Max stat baseline standard for percentage visualization (255 max)
    return Math.min(Math.round((statValue / 200) * 100), 100);
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }
}

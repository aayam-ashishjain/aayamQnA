import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SlidoSocketService } from '../services/slido-socket.service';

@Component({
  selector: 'app-participant-room',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="room-shell">
      <header class="room-header">
        <div>
          <h2>{{ slido.eventTitle() || 'Join Live Session' }}</h2>
          @if (slido.joinCode()) {
            <small>#{{ slido.joinCode() }}</small>
          }
        </div>
        <div class="tabs">
          <button (click)="tab.set('qa')" [class.active]="tab() === 'qa'">Q&amp;A</button>
          <button (click)="tab.set('polls')" [class.active]="tab() === 'polls'">
            Polls @if (slido.activePoll()) { <span class="dot">●</span> }
          </button>
        </div>
      </header>

      @if (slido.errorBanner(); as err) {
        <div class="error-toast">{{ err }}</div>
      }

      @if (!slido.joinCode()) {
        <form (ngSubmit)="joinByCode()" class="card join-box">
          <input [(ngModel)]="codeInput" name="code" placeholder="Enter 6-character code" required />
          <button type="submit" class="primary-btn">Join Room</button>
          <a routerLink="/login" class="host-link">Host sign in →</a>
        </form>
      } @else if (tab() === 'qa') {
        <form (ngSubmit)="ask()" class="card ask-box">
          <textarea [(ngModel)]="questionText" name="q" rows="3" maxlength="300" placeholder="Ask the speaker..." required></textarea>
          <div class="ask-row">
            <input [(ngModel)]="authorName" name="author" maxlength="40" placeholder="Your name (optional)" />
            <button type="submit" class="primary-btn">Send</button>
          </div>
        </form>

        <div class="q-list">
          @for (q of visibleQuestions(); track q._id) {
            <article class="card q-card" [class.highlighted]="q.isHighlighted">
              <p>{{ q.text }}</p>
              <footer>
                <small>{{ q.authorName }} · {{ q.status }}</small>
                <button
                  class="vote-btn"
                  (click)="slido.toggleUpvote(q._id)"
                  [class.voted]="q.upvotedBy.includes(slido.clientId)">
                  ▲ {{ q.upvotes }}
                </button>
              </footer>
            </article>
          } @empty {
            <p class="empty">No questions yet. Be the first to ask.</p>
          }
        </div>
      } @else {
        @if (slido.quizAutoState().phase === 'finished') {
          <div class="quiz-banner done">
            Quiz finished! Check the main screen for the final leaderboard.
          </div>
        } @else if (slido.quizAutoState().running) {
          <div class="quiz-banner">
            <span>Question {{ slido.quizAutoState().currentIndex + 1 }} of {{ slido.quizAutoState().total }}</span>
            @if (slido.quizAutoState().paused) {
              <strong>Paused</strong>
            } @else if (slido.quizAutoState().phase === 'reveal' && phaseSecondsLeft() !== null) {
              <strong>Next in {{ phaseSecondsLeft() }}s</strong>
            } @else if (slido.quizAutoState().phase === 'leaderboard' && phaseSecondsLeft() !== null) {
              <strong>Leaderboard · Next Q in {{ phaseSecondsLeft() }}s</strong>
            }
          </div>
        }

        @if (slido.activePoll(); as poll) {
          <section class="card poll-card">
            <div class="poll-head">
              <h3>{{ poll.question }}</h3>
              @if (secondsLeft() !== null) {
                <span class="timer-pill">⏱ {{ secondsLeft() }}s</span>
              }
            </div>

            @if (poll.type === 'multiple_choice' || poll.type === 'quiz') {
              @if (poll.type === 'quiz') {
                <input [(ngModel)]="authorName" name="quizPlayer" class="player-input" placeholder="Your leaderboard name" />
              }
              <div class="options-stack">
                @for (opt of poll.options; track opt._id) {
                  <button
                    class="option-btn"
                    [class.selected]="selectedOptionId() === opt._id"
                    [class.correct]="poll.type === 'quiz' && poll.status === 'locked' && opt.isCorrect"
                    [disabled]="poll.status === 'locked' || !!selectedOptionId()"
                    (click)="voteOption(poll._id, opt._id)">
                    <span>
                      {{ opt.text }}
                      @if (selectedOptionId() === opt._id && !poll.showResults) {
                        <em class="voted-tag">Selected</em>
                      }
                    </span>
                    @if (poll.showResults) {
                      <strong>{{ votePercent(opt.votes) }}% ({{ opt.votes }})</strong>
                    }
                  </button>
                }
              </div>
            }

            @if (poll.type === 'word_cloud' || poll.type === 'open_text') {
              <form (ngSubmit)="voteText(poll._id)" class="text-vote-form">
                <input [(ngModel)]="textVote" name="textVote" maxlength="200" placeholder="Type a word or short answer" required />
                <button type="submit" class="primary-btn" [disabled]="poll.status === 'locked'">Submit</button>
              </form>
              <div class="cloud">
                @for (w of slido.wordCloud(); track w.word) {
                  <span [style.fontSize.px]="14 + w.count * 4">{{ w.word }} ({{ w.count }})</span>
                }
              </div>
            }

            @if (poll.type === 'rating') {
              <div class="stars">
                @for (star of [1, 2, 3, 4, 5]; track star) {
                  <button
                    class="star-btn"
                    [disabled]="poll.status === 'locked'"
                    (click)="slido.castVote({ pollId: poll._id, ratingValue: star })">
                    {{ star }} ★
                  </button>
                }
              </div>
              @if (slido.ratingSummary(); as rs) {
                <p class="rating-meta">Average: <strong>{{ rs.average }} / 5</strong> ({{ rs.count }} votes)</p>
              }
            }
          </section>
        } @else {
          <p class="empty">No active poll right now.</p>
        }
      }
    </div>
  `,
  styles: [`
    .room-shell { max-width: 640px; margin: 1.5rem auto; padding: 0 1rem; }
    .room-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; }
    .room-header h2 { margin: 0; font-size: 1.35rem; }
    .room-header small { color: #64748b; font-weight: 700; }
    .tabs { display: flex; gap: 0.4rem; }
    .tabs button {
      background: #e2e8f0;
      border: none;
      border-radius: 999px;
      padding: 0.45rem 0.95rem;
      font-weight: 600;
    }
    .tabs button.active { background: #0f172a; color: #ffffff; }
    .dot { color: #22c55e; margin-left: 0.2rem; }
    .quiz-banner {
      background: #0f172a;
      color: #f8fafc;
      border-radius: 12px;
      padding: 0.7rem 1rem;
      margin-bottom: 0.85rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }
    .quiz-banner strong { color: #fde68a; }
    .quiz-banner.done { background: #065f46; color: #ecfdf5; justify-content: center; font-weight: 700; }
    .card {
      background: #ffffff;
      border-radius: 14px;
      padding: 1.15rem;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
      margin-bottom: 1rem;
    }
    .poll-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
    .poll-head h3 { margin: 0; }
    .timer-pill {
      background: #fef3c7;
      color: #92400e;
      font-weight: 800;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      white-space: nowrap;
      font-size: 0.9rem;
    }
    .join-box { display: flex; flex-direction: column; gap: 0.85rem; }
    .join-box input, .ask-box textarea, .ask-box input, .text-vote-form input, .player-input {
      width: 100%;
      padding: 0.7rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
    }
    .primary-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0.7rem 1.2rem;
      font-weight: 700;
    }
    .host-link { text-align: center; color: #475569; font-size: 0.9rem; text-decoration: none; }
    .ask-row { display: flex; gap: 0.6rem; margin-top: 0.6rem; }
    .q-card.highlighted { border: 2px solid #0284c7; }
    .q-card p { margin: 0 0 0.75rem; line-height: 1.45; }
    .q-card footer { display: flex; justify-content: space-between; align-items: center; }
    .vote-btn { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 999px; padding: 0.35rem 0.8rem; font-weight: 700; }
    .vote-btn.voted { background: #0284c7; color: #ffffff; border-color: #0284c7; }
    .options-stack { display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1rem; }
    .option-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      text-align: left;
    }
    .option-btn.selected { border: 2px solid #0284c7; background: #e0f2fe; font-weight: 700; }
    .option-btn.correct { border: 2px solid #10b981; background: #d1fae5; color: #065f46; font-weight: 700; }
    .voted-tag {
      font-style: normal;
      font-size: 0.78rem;
      margin-left: 0.5rem;
      padding: 0.12rem 0.45rem;
      border-radius: 999px;
      background: #0284c7;
      color: #ffffff;
    }
    .player-input { margin-top: 0.85rem; }
    .text-vote-form { display: flex; gap: 0.6rem; margin-top: 0.85rem; }
    .cloud { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; align-items: center; }
    .stars { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.85rem; }
    .star-btn { padding: 0.65rem 1rem; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; font-weight: 700; }
    .rating-meta { margin-top: 1rem; color: #475569; }
    .empty { text-align: center; color: #64748b; padding: 2rem; }
  `]
})
export class ParticipantRoomComponent implements OnInit, OnDestroy {
  slido = inject(SlidoSocketService);
  private route = inject(ActivatedRoute);

  tab = signal<'qa' | 'polls'>('qa');
  secondsLeft = signal<number | null>(null);
  phaseSecondsLeft = signal<number | null>(null);
  selectedOptionId = signal<string | null>(null);

  codeInput = '';
  questionText = '';
  authorName = '';
  textVote = '';

  private pollShownAt = Date.now();
  private lastPollId: string | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const poll = this.slido.activePoll();
      if (poll && poll._id !== this.lastPollId) {
        this.lastPollId = poll._id;
        this.pollShownAt = Date.now();
        this.selectedOptionId.set(null);
        if (poll.status === 'active') {
          this.tab.set('polls');
        }
      } else if (!poll) {
        this.lastPollId = null;
        this.selectedOptionId.set(null);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');
    if (code) {
      this.slido.joinRoom(code, 'participant');
    }

    this.tickHandle = setInterval(() => {
      const now = Date.now();
      const endsAt = this.slido.pollEndsAt();
      this.secondsLeft.set(endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null);

      const phaseEnd = this.slido.quizAutoState().phaseEndsAt;
      this.phaseSecondsLeft.set(phaseEnd ? Math.max(0, Math.ceil((phaseEnd - now) / 1000)) : null);
    }, 250);
  }

  ngOnDestroy(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
  }

  visibleQuestions = computed(() =>
    this.slido.questions().filter((q) => q.status === 'approved' || q.status === 'answered')
  );

  totalVotes = computed(() =>
    (this.slido.activePoll()?.options || []).reduce((sum, o) => sum + o.votes, 0)
  );

  joinByCode(): void {
    if (!this.codeInput.trim()) return;
    this.slido.joinRoom(this.codeInput, 'participant');
  }

  votePercent(count: number): number {
    const total = this.totalVotes();
    return total ? Math.round((count / total) * 100) : 0;
  }

  ask(): void {
    if (!this.questionText.trim()) return;
    this.slido.submitQuestion(this.questionText, this.authorName);
    this.questionText = '';
  }

  voteOption(pollId: string, optionId: string): void {
    if (this.selectedOptionId()) return;
    this.selectedOptionId.set(optionId);
    this.slido.castVote({
      pollId,
      optionId,
      displayName: this.authorName || 'Player',
      responseMs: Date.now() - this.pollShownAt
    });
  }

  voteText(pollId: string): void {
    if (!this.textVote.trim()) return;
    this.slido.castVote({ pollId, textValue: this.textVote });
    this.textVote = '';
  }
}

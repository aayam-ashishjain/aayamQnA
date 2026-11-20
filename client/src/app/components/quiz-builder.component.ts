import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PollItem, SlidoSocketService } from '../services/slido-socket.service';

interface DraftOption {
  id: number;
  text: string;
}

@Component({
  selector: 'app-quiz-builder',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="quiz-studio">
      <div class="runner-bar">
        <div class="runner-top">
          <div class="runner-stats">
            <strong>{{ quizQuestions().length }} Quiz Questions</strong>
            <span>· {{ slido.leaderboard().length }} Players Scored</span>
          </div>
          <div class="btn-row">
            <button
              type="button"
              class="stage-btn"
              [class.active]="slido.stageLeaderboard()"
              (click)="slido.setStageLeaderboard(!slido.stageLeaderboard())">
              {{ slido.stageLeaderboard() ? 'Hide Leaderboard' : 'Show Leaderboard' }}
            </button>
            <button type="button" class="danger-btn" (click)="resetScores()">Reset Quiz</button>
          </div>
        </div>

        @if (slido.quizAutoState().running) {
          <div class="auto-live-deck">
            <div class="auto-status">
              <span class="live-dot">●</span>
              <strong>
                Q{{ slido.quizAutoState().currentIndex + 1 }} / {{ slido.quizAutoState().total }}
              </strong>
              <span>· {{ phaseText() }}</span>
              @if (slido.quizAutoState().paused) {
                <span class="pause-pill">PAUSED</span>
              } @else if (phaseSecondsLeft() !== null) {
                <span class="clock-pill">⏱ {{ phaseSecondsLeft() }}s</span>
              }
            </div>
            <div class="btn-row">
              @if (slido.quizAutoState().paused) {
                <button type="button" class="start-auto-btn" (click)="slido.resumeAutoQuiz()">▶ Resume</button>
              } @else {
                <button type="button" class="warn-btn" (click)="slido.pauseAutoQuiz()">❚❚ Pause</button>
              }
              <button type="button" class="stage-btn" (click)="slido.nextAutoQuizStep()">Next Step →</button>
              <button type="button" class="danger-btn" (click)="slido.stopAutoQuiz()">■ Stop</button>
            </div>
          </div>
        } @else {
          <div class="auto-config-bar">
            <div class="auto-selects">
              <label>
                Reveal pause
                <select [(ngModel)]="revealSeconds" name="revealSec">
                  <option [ngValue]="3">3 sec</option>
                  <option [ngValue]="5">5 sec</option>
                  <option [ngValue]="8">8 sec</option>
                  <option [ngValue]="10">10 sec</option>
                </select>
              </label>
              <label>
                Between questions
                <select [(ngModel)]="leaderboardSeconds" name="lbSec">
                  <option [ngValue]="0">Straight to next</option>
                  <option [ngValue]="5">5s Leaderboard</option>
                  <option [ngValue]="8">8s Leaderboard</option>
                </select>
              </label>
              <label>
                Default timer
                <select [(ngModel)]="defaultTimerSeconds" name="defSec">
                  <option [ngValue]="15">15 sec</option>
                  <option [ngValue]="20">20 sec</option>
                  <option [ngValue]="30">30 sec</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              class="start-auto-btn"
              [disabled]="!quizQuestions().length"
              (click)="startAutoQuiz()">
              ▶ Start Auto-Quiz ({{ quizQuestions().length }} Qs)
            </button>
          </div>
        }
      </div>

      <form (ngSubmit)="saveQuestion()" class="builder-card">
        <h4>Add Quiz Question</h4>

        @if (formError()) {
          <div class="inline-err">{{ formError() }}</div>
        }

        <div class="meta-row">
          <input
            [(ngModel)]="quizName"
            name="quizName"
            placeholder="Quiz title (e.g. Architecture Trivia)" />
          <select [(ngModel)]="timerSeconds" name="timerSeconds">
            <option [ngValue]="15">15 sec timer</option>
            <option [ngValue]="20">20 sec timer</option>
            <option [ngValue]="30">30 sec timer</option>
            <option [ngValue]="45">45 sec timer</option>
            <option [ngValue]="60">60 sec timer</option>
            <option [ngValue]="0">Use default timer</option>
          </select>
        </div>

        <textarea
          [(ngModel)]="questionText"
          name="quizQuestion"
          rows="2"
          placeholder="Type your quiz question..."
          required></textarea>

        <div class="options-editor">
          <div class="options-header">
            <span>Answer Options</span>
            <small>Select the correct answer</small>
          </div>

          @for (opt of draftOptions; track opt.id; let idx = $index) {
            <div class="option-row" [class.is-correct]="correctOptionId === opt.id">
              <label class="radio-pick" title="Mark as correct answer">
                <input
                  type="radio"
                  name="correctOption"
                  [value]="opt.id"
                  [(ngModel)]="correctOptionId" />
                <span>Correct</span>
              </label>

              <input
                [(ngModel)]="opt.text"
                [name]="'opt_' + opt.id"
                [placeholder]="'Option ' + (idx + 1)" />

              @if (draftOptions.length > 2) {
                <button type="button" class="remove-opt" (click)="removeOption(opt.id)">×</button>
              }
            </div>
          }

          @if (draftOptions.length < 6) {
            <button type="button" class="add-opt" (click)="addOption()">+ Add Option</button>
          }
        </div>

        <button type="submit" class="primary-btn" [disabled]="saving()">
          {{ saving() ? 'Saving...' : 'Save Quiz Question' }}
        </button>
      </form>

      <section class="queue-list">
        <h4>Configured Quiz Queue</h4>

        @for (q of quizQuestions(); track q._id; let idx = $index) {
          <article class="quiz-item" [class.live]="q.status === 'active'" [class.locked]="q.status === 'locked'">
            <div class="quiz-item-head">
              <div>
                <span class="q-badge">Q{{ idx + 1 }}</span>
                @if (q.surveyGroupId) {
                  <span class="group-tag">{{ q.surveyGroupId }}</span>
                }
                <span class="timer-tag">⏱ {{ q.timerSeconds || defaultTimerSeconds }}s</span>
                <span class="state-tag">{{ q.status }}</span>
              </div>
              <button type="button" class="text-danger" (click)="deleteQuestion(q._id)">Delete</button>
            </div>

            <p class="q-title">{{ q.question }}</p>

            <ul class="answer-preview">
              @for (opt of q.options; track opt._id) {
                <li [class.correct-ans]="opt.isCorrect">
                  <span>{{ opt.isCorrect ? '✓' : '•' }} {{ opt.text }}</span>
                  <strong>{{ opt.votes }} votes</strong>
                </li>
              }
            </ul>

            <div class="btn-row">
              <button type="button" class="go-btn" (click)="startAutoFrom(q)">
                ▶ Auto from Q{{ idx + 1 }}
              </button>
              <button type="button" (click)="startQuestionManual(q)">
                Manual Start
              </button>
              <button type="button" class="reveal-btn" (click)="revealAnswer(q)">
                Lock &amp; Reveal
              </button>
              <button type="button" (click)="slido.setPollState(q._id, 'draft', false)">
                Hide
              </button>
            </div>
          </article>
        } @empty {
          <p class="muted">No quiz questions configured yet. Add Question 1 above.</p>
        }
      </section>
    </div>
  `,
  styles: [`
    .quiz-studio { display: flex; flex-direction: column; gap: 1rem; }
    .runner-bar {
      background: #0f172a;
      color: #f8fafc;
      border-radius: 12px;
      padding: 0.95rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .runner-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .runner-stats span { color: #94a3b8; font-size: 0.86rem; margin-left: 0.3rem; }
    .auto-config-bar {
      border-top: 1px solid #1e293b;
      padding-top: 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }
    .auto-selects {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
    }
    .auto-selects label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 600;
    }
    .auto-selects select {
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 0.38rem 0.45rem;
      font-size: 0.82rem;
    }
    .auto-live-deck {
      border-top: 1px solid #1e293b;
      padding-top: 0.8rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.65rem;
    }
    .auto-status { display: flex; align-items: center; gap: 0.45rem; font-size: 0.9rem; }
    .live-dot { color: #22c55e; }
    .clock-pill { background: #78350f; color: #fde68a; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 800; font-size: 0.82rem; }
    .pause-pill { background: #475569; color: #f8fafc; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 800; font-size: 0.78rem; }
    .start-auto-btn {
      background: #10b981;
      color: #052e16;
      border: none;
      border-radius: 8px;
      padding: 0.62rem 1rem;
      font-weight: 800;
      font-size: 0.92rem;
    }
    .start-auto-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .warn-btn {
      background: #f59e0b;
      color: #1c1917;
      border: none;
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      font-size: 0.84rem;
      font-weight: 700;
    }
    .stage-btn {
      background: #1e293b;
      color: #38bdf8;
      border: 1px solid #38bdf8;
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      font-size: 0.84rem;
      font-weight: 700;
    }
    .stage-btn.active { background: #38bdf8; color: #0f172a; }
    .danger-btn {
      background: #7f1d1d;
      color: #fecaca;
      border: none;
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      font-size: 0.84rem;
      font-weight: 600;
    }
    .builder-card {
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 1rem;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .builder-card h4, .queue-list h4 { margin: 0; font-size: 1rem; }
    .inline-err {
      background: #fee2e2;
      color: #991b1b;
      padding: 0.55rem 0.8rem;
      border-radius: 8px;
      font-size: 0.86rem;
      font-weight: 600;
    }
    .meta-row { display: grid; grid-template-columns: 1fr 180px; gap: 0.6rem; }
    .builder-card input, .builder-card textarea, .builder-card select {
      padding: 0.6rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
    }
    .options-editor { display: flex; flex-direction: column; gap: 0.5rem; }
    .options-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
    }
    .option-row {
      display: grid;
      grid-template-columns: 92px 1fr auto;
      gap: 0.5rem;
      align-items: center;
      padding: 0.35rem 0.5rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .option-row.is-correct { border-color: #10b981; background: #ecfdf5; }
    .radio-pick {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.82rem;
      font-weight: 600;
      color: #047857;
      cursor: pointer;
    }
    .remove-opt {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.2rem;
      padding: 0 0.4rem;
    }
    .add-opt {
      align-self: flex-start;
      background: none;
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      font-size: 0.85rem;
      color: #334155;
      font-weight: 600;
    }
    .primary-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0.7rem;
      font-weight: 700;
    }
    .quiz-item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.9rem;
      margin-top: 0.75rem;
      background: #ffffff;
    }
    .quiz-item.live { border: 2px solid #0284c7; background: #f0f9ff; }
    .quiz-item.locked { border: 2px solid #10b981; }
    .quiz-item-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .q-badge, .group-tag, .timer-tag, .state-tag {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.18rem 0.5rem;
      border-radius: 999px;
      margin-right: 0.35rem;
    }
    .q-badge { background: #0f172a; color: #ffffff; }
    .group-tag { background: #e0f2fe; color: #0369a1; }
    .timer-tag { background: #fef3c7; color: #92400e; }
    .state-tag { background: #f1f5f9; color: #475569; text-transform: uppercase; }
    .text-danger { background: none; border: none; color: #b91c1c; font-size: 0.82rem; font-weight: 600; }
    .q-title { margin: 0 0 0.6rem; font-weight: 700; font-size: 1rem; }
    .answer-preview {
      list-style: none;
      padding: 0;
      margin: 0 0 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      font-size: 0.88rem;
    }
    .answer-preview li {
      display: flex;
      justify-content: space-between;
      padding: 0.3rem 0.55rem;
      border-radius: 6px;
      background: #f8fafc;
    }
    .answer-preview li.correct-ans { background: #d1fae5; color: #065f46; font-weight: 700; }
    .btn-row { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .btn-row button {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      font-size: 0.84rem;
      font-weight: 600;
    }
    .btn-row .go-btn { background: #0284c7; color: #ffffff; border-color: #0284c7; }
    .btn-row .reveal-btn { background: #059669; color: #ffffff; border-color: #059669; }
    .muted { color: #64748b; font-size: 0.9rem; }
  `]
})
export class QuizBuilderComponent implements OnInit, OnDestroy {
  slido = inject(SlidoSocketService);

  private nextId = 5;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  quizName = 'Live Quiz';
  questionText = '';
  timerSeconds = 20;
  revealSeconds = 5;
  leaderboardSeconds = 0;
  defaultTimerSeconds = 20;
  correctOptionId = 1;
  draftOptions: DraftOption[] = [
    { id: 1, text: '' },
    { id: 2, text: '' },
    { id: 3, text: '' },
    { id: 4, text: '' }
  ];

  saving = signal(false);
  formError = signal<string | null>(null);
  phaseSecondsLeft = signal<number | null>(null);

  quizQuestions = computed(() =>
    this.slido.polls().filter((p) => p.type === 'quiz')
  );

  phaseText = computed(() => {
    const phase = this.slido.quizAutoState().phase;
    if (phase === 'question') return 'Answering';
    if (phase === 'reveal') return 'Revealing Answer';
    if (phase === 'leaderboard') return 'Leaderboard Break';
    return 'Running';
  });

  ngOnInit(): void {
    this.tickHandle = setInterval(() => {
      const endsAt = this.slido.quizAutoState().phaseEndsAt;
      if (!endsAt) {
        this.phaseSecondsLeft.set(null);
        return;
      }
      this.phaseSecondsLeft.set(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
  }

  ngOnDestroy(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
  }

  startAutoQuiz(): void {
    this.slido.startAutoQuiz({
      revealSeconds: Number(this.revealSeconds),
      leaderboardSeconds: Number(this.leaderboardSeconds),
      defaultTimerSeconds: Number(this.defaultTimerSeconds)
    });
  }

  startAutoFrom(poll: PollItem): void {
    this.slido.startAutoQuiz({
      revealSeconds: Number(this.revealSeconds),
      leaderboardSeconds: Number(this.leaderboardSeconds),
      defaultTimerSeconds: Number(this.defaultTimerSeconds),
      startPollId: poll._id
    });
  }

  addOption(): void {
    if (this.draftOptions.length >= 6) return;
    this.draftOptions.push({ id: this.nextId++, text: '' });
  }

  removeOption(id: number): void {
    this.draftOptions = this.draftOptions.filter((o) => o.id !== id);
    if (this.correctOptionId === id && this.draftOptions.length) {
      this.correctOptionId = this.draftOptions[0].id;
    }
  }

  async saveQuestion(): Promise<void> {
    this.formError.set(null);
    const cleanQ = this.questionText.trim();
    const filled = this.draftOptions
      .map((o) => ({ id: o.id, text: o.text.trim() }))
      .filter((o) => o.text.length > 0);

    if (!cleanQ) {
      this.formError.set('Enter the quiz question text.');
      return;
    }
    if (filled.length < 2) {
      this.formError.set('Fill in at least 2 answer options.');
      return;
    }
    if (!filled.some((o) => o.id === this.correctOptionId)) {
      this.formError.set('Mark one of the filled options as the correct answer.');
      return;
    }

    this.saving.set(true);
    try {
      await this.slido.createPoll({
        type: 'quiz',
        question: cleanQ,
        timerSeconds: Number(this.timerSeconds),
        surveyGroupId: this.quizName.trim() || null,
        showResults: false,
        options: filled.map((o) => ({
          _id: '',
          text: o.text,
          isCorrect: o.id === this.correctOptionId,
          votes: 0
        }))
      });

      this.questionText = '';
      this.correctOptionId = this.nextId;
      this.draftOptions = [
        { id: this.nextId++, text: '' },
        { id: this.nextId++, text: '' },
        { id: this.nextId++, text: '' },
        { id: this.nextId++, text: '' }
      ];
    } catch (err: any) {
      this.formError.set(err?.error?.error || 'Could not save quiz question.');
    } finally {
      this.saving.set(false);
    }
  }

  startQuestionManual(poll: PollItem): void {
    this.slido.setPollState(poll._id, 'active', false);
  }

  revealAnswer(poll: PollItem): void {
    this.slido.setPollState(poll._id, 'locked', true);
  }

  async deleteQuestion(pollId: string): Promise<void> {
    await this.slido.deletePoll(pollId);
  }

  async resetScores(): Promise<void> {
    if (!confirm('Reset all quiz scores and clear previous quiz votes so you can run a fresh game?')) return;
    await this.slido.resetQuizScores();
  }
}

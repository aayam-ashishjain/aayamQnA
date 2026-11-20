import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ADSQuizMasterSocketService } from '../services/ADSQuizMaster-socket.service';
import { QuizBuilderComponent } from './quiz-builder.component';

@Component({
  selector: 'app-host-console',
  standalone: true,
  imports: [FormsModule, RouterLink, QuizBuilderComponent],
  template: `
    <div class="console-shell">
      <header class="console-header">
        <div>
          <a routerLink="/dashboard" class="back-link">← All Events</a>
          <h1>{{ ADSQuizMaster.eventTitle() || 'Host Console' }} <span>#{{ ADSQuizMaster.joinCode() }}</span></h1>
        </div>
        <div class="header-actions">
          <a [routerLink]="['/present', ADSQuizMaster.joinCode()]" target="_blank" class="btn">Open Present Mode</a>
          <button (click)="ADSQuizMaster.downloadQaCsv()" class="btn secondary">Export Q&amp;A CSV</button>
        </div>
      </header>

      @if (ADSQuizMaster.errorBanner(); as err) {
        <div class="error-toast">{{ err }}</div>
      }

      <div class="host-grid">
        <section class="panel">
          <h3>Pending Review ({{ pending().length }})</h3>
          @for (q of pending(); track q._id) {
            <div class="mod-card pending">
              <p>{{ q.text }} — <small>{{ q.authorName }}</small></p>
              <div class="btn-row">
                <button (click)="ADSQuizMaster.moderateQuestion(q._id, 'approved')">Approve</button>
                <button (click)="ADSQuizMaster.moderateQuestion(q._id, 'archived')" class="danger">Dismiss</button>
              </div>
            </div>
          } @empty {
            <p class="muted">No pending questions.</p>
          }

          <h3>Live Q&amp;A ({{ live().length }})</h3>
          @for (q of live(); track q._id) {
            <div class="mod-card" [class.highlighted]="q.isHighlighted">
              <p><strong>[▲ {{ q.upvotes }}]</strong> {{ q.text }} — <small>{{ q.authorName }}</small></p>
              <div class="btn-row">
                <button (click)="ADSQuizMaster.moderateQuestion(q._id, undefined, !q.isHighlighted)">
                  {{ q.isHighlighted ? 'Unhighlight' : 'Highlight' }}
                </button>
                <button (click)="ADSQuizMaster.moderateQuestion(q._id, 'answered', false)">Mark Answered</button>
                <button (click)="ADSQuizMaster.moderateQuestion(q._id, 'archived', false)" class="danger">Archive</button>
              </div>
            </div>
          } @empty {
            <p class="muted">No live questions yet.</p>
          }
        </section>

        <section class="panel">
          <div class="panel-tabs">
            <button type="button" (click)="rightTab.set('polls')" [class.active]="rightTab() === 'polls'">
              Live Polls ({{ standardPolls().length }})
            </button>
            <button type="button" (click)="rightTab.set('quiz')" [class.active]="rightTab() === 'quiz'">
              Quiz Studio ({{ quizCount() }})
            </button>
          </div>

          @if (rightTab() === 'polls') {
            <form (ngSubmit)="addPoll()" class="poll-form">
              <input [(ngModel)]="newPollQuestion" name="pq" placeholder="Poll question" required />
              <select [(ngModel)]="newPollType" name="pt">
                <option value="multiple_choice">Multiple Choice</option>
                <option value="word_cloud">Word Cloud</option>
                <option value="rating">Rating (1-5)</option>
                <option value="open_text">Open Text</option>
              </select>
              @if (newPollType === 'multiple_choice') {
                <input [(ngModel)]="rawOptions" name="opts" placeholder="Options (comma-separated)" />
              }
              <button type="submit" class="primary-btn">Save Poll Draft</button>
            </form>

            @for (p of standardPolls(); track p._id) {
              <div class="poll-row">
                <div class="poll-row-head">
                  <div>
                    <strong>{{ p.question }}</strong>
                    <small>{{ p.type }} · {{ p.status }}</small>
                  </div>
                  <button type="button" class="text-danger" (click)="ADSQuizMaster.deletePoll(p._id)">Delete</button>
                </div>
                <div class="btn-row">
                  <button (click)="ADSQuizMaster.setPollState(p._id, 'active', true)">Launch</button>
                  <button (click)="ADSQuizMaster.setPollState(p._id, 'active', false)">Launch Hidden</button>
                  <button (click)="ADSQuizMaster.setPollState(p._id, 'locked', true)">Lock</button>
                  <button (click)="ADSQuizMaster.setPollState(p._id, 'draft', false)">Hide</button>
                </div>
              </div>
            } @empty {
              <p class="muted">No standard polls yet.</p>
            }
          } @else {
            <app-quiz-builder />
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .console-shell { max-width: 1180px; margin: 1.5rem auto; padding: 0 1.25rem; }
    .console-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
    .back-link { text-decoration: none; color: #0284c7; font-size: 0.9rem; font-weight: 600; }
    h1 { margin: 0.2rem 0 0; font-size: 1.6rem; }
    h1 span { color: #0284c7; }
    .header-actions { display: flex; gap: 0.6rem; }
    .btn { background: #0f172a; color: #fff; text-decoration: none; border: none; border-radius: 8px; padding: 0.6rem 1rem; font-weight: 600; }
    .btn.secondary { background: #e2e8f0; color: #0f172a; }
    .host-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem; }
    .panel { background: #ffffff; border-radius: 14px; padding: 1.25rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05); }
    .panel h3 { margin-top: 0; }
    .panel-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .panel-tabs button {
      flex: 1;
      padding: 0.6rem;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      font-weight: 700;
    }
    .panel-tabs button.active { background: #0f172a; color: #ffffff; border-color: #0f172a; }
    .mod-card, .poll-row { border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.9rem; margin-bottom: 0.75rem; }
    .mod-card.pending { background: #fffbeb; border-color: #fde68a; }
    .mod-card.highlighted { border: 2px solid #0284c7; background: #f0f9ff; }
    .mod-card p { margin: 0 0 0.65rem; }
    .poll-row-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; }
    .poll-row small { display: block; color: #64748b; margin: 0.2rem 0 0.65rem; }
    .text-danger { background: none; border: none; color: #b91c1c; font-size: 0.82rem; font-weight: 600; }
    .btn-row { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .btn-row button { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.35rem 0.7rem; font-size: 0.85rem; font-weight: 600; }
    .btn-row button.danger { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
    .poll-form { display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.25rem; }
    .poll-form input, .poll-form select { padding: 0.65rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; }
    .primary-btn { background: #0284c7; color: #fff; border: none; border-radius: 8px; padding: 0.7rem; font-weight: 700; }
    .muted { color: #64748b; font-size: 0.9rem; }
  `]
})
export class HostConsoleComponent implements OnInit {
  ADSQuizMaster = inject(ADSQuizMasterSocketService);
  private route = inject(ActivatedRoute);

  rightTab = signal<'polls' | 'quiz'>('quiz');
  newPollQuestion = '';
  newPollType: 'multiple_choice' | 'word_cloud' | 'rating' | 'open_text' = 'multiple_choice';
  rawOptions = '';

  pending = computed(() => this.ADSQuizMaster.questions().filter((q) => q.status === 'pending'));
  live = computed(() => this.ADSQuizMaster.questions().filter((q) => q.status === 'approved'));
  standardPolls = computed(() => this.ADSQuizMaster.polls().filter((p) => p.type !== 'quiz'));
  quizCount = computed(() => this.ADSQuizMaster.polls().filter((p) => p.type === 'quiz').length);

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');
    if (code) {
      this.ADSQuizMaster.joinRoom(code, 'host');
    }
  }

  async addPoll(): Promise<void> {
    if (!this.newPollQuestion.trim()) return;
    const options = this.rawOptions
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({
        _id: '',
        text,
        isCorrect: false,
        votes: 0
      }));

    await this.ADSQuizMaster.createPoll({
      question: this.newPollQuestion.trim(),
      type: this.newPollType,
      options
    });

    this.newPollQuestion = '';
    this.rawOptions = '';
  }
}

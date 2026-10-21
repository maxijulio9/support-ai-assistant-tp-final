import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService } from './config.service';
import { ConfigStatusService } from './config-status.service';
import { toSectionCardLoadState } from './config-readiness';
import { classifyFormError } from '../../shared/form-error';
import {
  LlmProvider,
  buildLlmSavePayload,
  canLoadChatModels,
  canSaveLlmConfiguration,
  effectiveKeyEditedFlag,
  generationKeyFor,
  llmPartChip,
  llmProviderLabel,
  llmSourceLabel,
  modelsStillValid,
  preselectModel,
  savedModelCandidate,
} from './llm-form';

export type ChatModelsState = 'idle' | 'loading' | 'loaded' | 'error';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

// Sin conectar a su propio GET: el panel y el formulario leen el estado
// compartido (ConfigStatusService), el mismo que usan el centro y el
// encabezado del shell de detalle. Asi, tras guardar, un unico
// configStatus.retry('llm') actualiza panel y estado compartido a la vez,
// sin pedir el GET por separado.
@Component({
  selector: 'app-llm-connection',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './llm-connection.component.html',
  styleUrl: './llm-connection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmConnectionComponent {
  private readonly configService = inject(ConfigService);
  private readonly configStatus = inject(ConfigStatusService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = this.configStatus.llm;
  readonly loadState = computed(() => toSectionCardLoadState(this.status().state));
  readonly llmConfig = computed(() => this.status().data);

  readonly form = new FormGroup({
    embeddingsApiKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    generationProvider: new FormControl<LlmProvider>('openai', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    generationApiKey: new FormControl('', { nonNullable: true }),
    // Empieza deshabilitado: recien se habilita cuando "Cargar modelos" trae
    // una lista con al menos un modelo. Se maneja con enable()/disable()
    // programatico, nunca con [disabled] en la plantilla, para no chocar
    // con el disable()/enable() general del guardado.
    generationModel: new FormControl<string | null>({ value: null, disabled: true }, { validators: [Validators.required] }),
  });

  private readonly embeddingsApiKeyValue = toSignal(this.form.controls.embeddingsApiKey.valueChanges, {
    initialValue: this.form.controls.embeddingsApiKey.value,
  });
  private readonly generationProviderValue = toSignal(this.form.controls.generationProvider.valueChanges, {
    initialValue: this.form.controls.generationProvider.value,
  });
  private readonly generationApiKeyValue = toSignal(this.form.controls.generationApiKey.valueChanges, {
    initialValue: this.form.controls.generationApiKey.value,
  });
  private readonly generationModelValue = toSignal(this.form.controls.generationModel.valueChanges, {
    initialValue: this.form.controls.generationModel.value,
  });

  readonly chatModelsState = signal<ChatModelsState>('idle');
  readonly chatModels = signal<string[]>([]);
  readonly chatModelsErrorMessage = signal<string | null>(null);
  readonly chatModelsEmpty = computed(
    () => this.chatModelsState() === 'loaded' && this.chatModels().length === 0,
  );

  readonly saving = signal(false);
  readonly saveErrorMessage = signal<string | null>(null);

  readonly embeddingsModel = computed(() => this.llmConfig()?.embeddings.model ?? '');
  readonly llmProviderLabel = llmProviderLabel;

  readonly generationChip = computed(() => {
    const data = this.llmConfig();
    return data ? llmPartChip(data.generation.configured) : null;
  });
  readonly embeddingsChip = computed(() => {
    const data = this.llmConfig();
    return data ? llmPartChip(data.embeddings.configured) : null;
  });
  readonly sourceLabel = computed(() => {
    const data = this.llmConfig();
    return data ? llmSourceLabel(data.source, data.updated_at) : null;
  });

  readonly isGeminiSelected = computed(() => this.generationProviderValue() === 'gemini');

  readonly canLoad = computed(() =>
    canLoadChatModels(this.generationProviderValue(), this.embeddingsApiKeyValue(), this.generationApiKeyValue()),
  );

  readonly canSave = computed(() =>
    canSaveLlmConfiguration({
      embeddingsApiKey: this.embeddingsApiKeyValue(),
      generationProvider: this.generationProviderValue(),
      generationApiKey: this.generationApiKeyValue(),
      chatModelsLoaded: this.chatModelsState() === 'loaded' && !this.chatModelsEmpty(),
      generationModel: this.generationModelValue(),
    }),
  );

  private modelsLoadedForProvider: LlmProvider | null = null;
  private embeddingsKeyEdited = false;
  private generationKeyEdited = false;
  private formSeeded = false;

  constructor() {
    this.configStatus.ensureLoaded('llm');

    // Precarga el proveedor ya configurado una sola vez, la primera vez que
    // llega el estado cargado: despues no se vuelve a tocar, para no pisar
    // lo que el admin este escribiendo si el panel se refresca solo.
    effect(() => {
      const slot = this.status();
      if (slot.state !== 'loaded' || this.formSeeded) return;
      this.formSeeded = true;
      if (slot.data) {
        this.form.controls.generationProvider.setValue(slot.data.generation.provider as LlmProvider);
      }
    });

    this.form.controls.embeddingsApiKey.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.embeddingsKeyEdited = true;
      this.resetChatModelsIfStale();
    });
    this.form.controls.generationApiKey.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.generationKeyEdited = true;
      this.resetChatModelsIfStale();
    });
    this.form.controls.generationProvider.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((provider) => {
        this.updateGenerationApiKeyValidator(provider);
        this.resetChatModelsIfStale();
      });
  }

  retryLoad(): void {
    this.configStatus.retry('llm');
  }

  loadModels(): void {
    if (!this.canLoad() || this.chatModelsState() === 'loading') return;

    const provider = this.form.controls.generationProvider.value;
    const apiKey = generationKeyFor(
      provider,
      this.form.controls.embeddingsApiKey.value,
      this.form.controls.generationApiKey.value,
    );

    this.chatModelsState.set('loading');
    this.chatModelsErrorMessage.set(null);

    this.configService
      .listLlmModels({ provider, api_key: apiKey })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.chatModels.set(response.chat_models);
          this.chatModelsState.set('loaded');
          this.modelsLoadedForProvider = provider;
          this.embeddingsKeyEdited = false;
          this.generationKeyEdited = false;

          if (response.chat_models.length === 0) {
            this.form.controls.generationModel.setValue(null);
            this.form.controls.generationModel.disable();
            return;
          }

          this.form.controls.generationModel.enable();
          const configured = this.llmConfig();
          const configuredProvider = configured ? (configured.generation.provider as LlmProvider) : null;
          const configuredModel = configured ? configured.generation.model : null;
          const candidate = savedModelCandidate(provider, configuredProvider, configuredModel);
          this.form.controls.generationModel.setValue(preselectModel(response.chat_models, candidate));
        },
        error: (error: unknown) => {
          this.chatModelsState.set('error');
          const result = classifyFormError(error);
          this.chatModelsErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
        },
      });
  }

  onSubmit(): void {
    if (!this.canSave() || this.saving()) return;

    // Se lee el valor de los controles antes de deshabilitar el form: una
    // vez deshabilitado, el mat-select de generationModel pierde su valor
    // (el control pasa a '' al leerlo despues), asi que el payload se arma
    // primero y recien despues se deshabilita para la espera del guardado.
    const payload = buildLlmSavePayload({
      embeddingsApiKey: this.form.controls.embeddingsApiKey.value,
      generationProvider: this.form.controls.generationProvider.value,
      generationApiKey: this.form.controls.generationApiKey.value,
      generationModel: this.form.controls.generationModel.value ?? '',
    });

    this.saving.set(true);
    this.saveErrorMessage.set(null);
    this.form.disable();

    this.configService
      .saveLlmConfig(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.enable();
          this.snackBar.open('Configuración guardada', 'Cerrar', { duration: 4000 });
          this.clearSecretsAndModels();
          // Un solo pedido: refresca el panel de esta pantalla y el estado
          // compartido que usan el centro y el encabezado del shell.
          this.configStatus.retry('llm');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.form.enable();
          const result = classifyFormError(error);
          this.saveErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
        },
      });
  }

  private resetChatModelsIfStale(): void {
    if (this.chatModelsState() === 'idle' || this.chatModelsState() === 'loading') return;

    const provider = this.form.controls.generationProvider.value;
    const edited = effectiveKeyEditedFlag(provider, this.embeddingsKeyEdited, this.generationKeyEdited);
    if (modelsStillValid(this.modelsLoadedForProvider, provider, edited)) return;

    this.chatModelsState.set('idle');
    this.chatModels.set([]);
    this.chatModelsErrorMessage.set(null);
    this.modelsLoadedForProvider = null;
    this.form.controls.generationModel.setValue(null);
    this.form.controls.generationModel.disable();
  }

  private updateGenerationApiKeyValidator(provider: LlmProvider): void {
    const control = this.form.controls.generationApiKey;
    if (provider === 'gemini') {
      control.addValidators(Validators.required);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  // Las claves nunca se devuelven: tras guardar, se limpian aca en vez de
  // quedar precargadas con lo que el admin tipeo.
  private clearSecretsAndModels(): void {
    this.form.patchValue({ embeddingsApiKey: '', generationApiKey: '' });
    this.chatModelsState.set('idle');
    this.chatModels.set([]);
    this.chatModelsErrorMessage.set(null);
    this.modelsLoadedForProvider = null;
    this.embeddingsKeyEdited = false;
    this.generationKeyEdited = false;
    this.form.controls.generationModel.setValue(null);
    this.form.controls.generationModel.disable();
  }
}

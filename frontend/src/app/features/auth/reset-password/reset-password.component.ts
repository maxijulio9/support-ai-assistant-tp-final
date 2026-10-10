import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [RouterLink],
  template: `<p>Próximamente</p><a routerLink="/login">Volver</a>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {}

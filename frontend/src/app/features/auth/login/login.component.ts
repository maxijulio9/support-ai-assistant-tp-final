import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `<p>Login</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {}

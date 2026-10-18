import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { listUsersApiUsersGet } from '../../api/fn/auth/list-users-api-users-get';
import { createUserApiUsersPost } from '../../api/fn/auth/create-user-api-users-post';
import { updateUserApiUsersUserIdPut } from '../../api/fn/auth/update-user-api-users-user-id-put';
import { deactivateUserApiUsersUserIdDeactivatePatch } from '../../api/fn/auth/deactivate-user-api-users-user-id-deactivate-patch';
import { activateUserApiUsersUserIdActivatePatch } from '../../api/fn/auth/activate-user-api-users-user-id-activate-patch';
import { CreateUserRequest } from '../../api/models/create-user-request';
import { UpdateUserRequest } from '../../api/models/update-user-request';
import { UserResponse } from '../../api/models/user-response';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  list(): Observable<UserResponse[]> {
    return listUsersApiUsersGet(this.http, this.apiConfig.rootUrl).pipe(map((response) => response.body.users));
  }

  create(request: CreateUserRequest): Observable<UserResponse> {
    return createUserApiUsersPost(this.http, this.apiConfig.rootUrl, { body: request }).pipe(
      map((response) => response.body),
    );
  }

  update(userId: string, request: UpdateUserRequest): Observable<UserResponse> {
    return updateUserApiUsersUserIdPut(this.http, this.apiConfig.rootUrl, {
      user_id: userId,
      body: request,
    }).pipe(map((response) => response.body));
  }

  deactivate(userId: string): Observable<UserResponse> {
    return deactivateUserApiUsersUserIdDeactivatePatch(this.http, this.apiConfig.rootUrl, {
      user_id: userId,
    }).pipe(map((response) => response.body));
  }

  activate(userId: string): Observable<UserResponse> {
    return activateUserApiUsersUserIdActivatePatch(this.http, this.apiConfig.rootUrl, {
      user_id: userId,
    }).pipe(map((response) => response.body));
  }
}

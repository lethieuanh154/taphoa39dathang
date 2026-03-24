import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import routeConfig from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { httpErrorInterceptor } from './interceptors/http-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routeConfig),
    provideHttpClient(withInterceptors([httpErrorInterceptor]))
  ]
};

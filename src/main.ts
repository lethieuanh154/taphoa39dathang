/*
 *  Protractor support is deprecated in Angular.
 *  Protractor is used in this example for compatibility with Angular documentation tools.
 */
import {bootstrapApplication, provideProtractorTestingSupport} from '@angular/platform-browser';
import {AppComponent} from './app/app.component';
import {provideRouter} from '@angular/router';
import routeConfig from './app/app.routes';
import {provideHttpClient} from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from './environments/environment';


bootstrapApplication(AppComponent, {
    providers: [
      provideHttpClient(),
      provideProtractorTestingSupport(),
      provideRouter(routeConfig),
      provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()) // 💥 PHẢI CÓ DÒNG NÀY
    ]
  },).catch((err) =>
  console.error(err),
);

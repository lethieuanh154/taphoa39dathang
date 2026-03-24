import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SnackbarService } from '../services/snackbar.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackbar = inject(SnackbarService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        snackbar.error('Không thể kết nối máy chủ. Kiểm tra kết nối mạng.');
      } else if (error.status >= 500 && error.status < 600) {
        const msg = getServerErrorMessage(error);
        snackbar.error(msg);
      }
      return throwError(() => error);
    })
  );
};

function getServerErrorMessage(error: HttpErrorResponse): string {
  const apiMsg = error.error?.message || error.error?.error;
  if (apiMsg && typeof apiMsg === 'string') {
    return apiMsg;
  }

  switch (error.status) {
    case 500: return 'Lỗi máy chủ. Vui lòng thử lại sau.';
    case 502: return 'Máy chủ tạm thời không phản hồi (502).';
    case 503: return 'Dịch vụ đang bảo trì. Vui lòng thử lại sau (503).';
    case 504: return 'Máy chủ phản hồi quá lâu (504). Vui lòng thử lại.';
    default: return `Lỗi máy chủ (${error.status}). Vui lòng thử lại sau.`;
  }
}

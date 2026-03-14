# HeaderComponent

## Mo ta
Thanh header sticky o tren cung, chua logo, o tim kiem, va nut gio hang.

## Selector
`app-header`

## Inputs/Outputs
- `@Output() search: EventEmitter<string>` - Emit khi nguoi dung search

## Chuc nang
- Hien thi logo Song Minh va ten cua hang
- O tim kiem san pham (Enter hoac click nut search)
- Nut gio hang voi badge so luong
- Responsive: an ten logo tren mobile

## Dependencies
- `CartService` - Lay so luong san pham trong gio
- `FormsModule` - Two-way binding cho search input

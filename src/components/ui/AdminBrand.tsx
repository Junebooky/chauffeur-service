// Shared operations lockup: use the same committed brand image as the customer navbar.
export default function AdminBrand() {
  return (
    <div className="admin-logo">
      <img
        className="admin-brand-mark"
        src="/media/brand/logo_brand.webp"
        alt=""
        width={34}
        height={34}
        draggable={false}
      />
      <span>CHAUFFEUR <small>OPERATIONS</small></span>
    </div>
  )
}

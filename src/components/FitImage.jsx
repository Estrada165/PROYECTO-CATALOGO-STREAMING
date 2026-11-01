// Imagen completa sin recortar, con su propio fondo desenfocado detrás
export default function FitImage({ src, alt = '', className = 'fit-img' }) {
  return (
    <div className={className}>
      <div className="fit-img__blur" style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" />
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </div>
  )
}

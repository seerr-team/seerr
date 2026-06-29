import Image, { type ImageProps } from 'next/image';

type SeerrLogoVariant = 'full' | 'stacked';

interface SeerrLogoProps extends Omit<ImageProps, 'alt' | 'src'> {
  alt?: string;
  variant: SeerrLogoVariant;
}

const getLogoSrc = (variant: SeerrLogoVariant, light = false) =>
  `/logo_${variant}${light ? '_light' : ''}.svg`;

const withLogoClass = (className: string | undefined, logoClass: string) =>
  [className, 'seerr-logo', logoClass].filter(Boolean).join(' ');

const SeerrLogo = ({
  alt = 'Logo',
  className,
  variant,
  ...props
}: SeerrLogoProps) => (
  <>
    <Image
      {...props}
      src={getLogoSrc(variant)}
      alt={alt}
      className={withLogoClass(className, 'seerr-logo-dark')}
    />
    <Image
      {...props}
      src={getLogoSrc(variant, true)}
      alt=""
      aria-hidden
      className={withLogoClass(className, 'seerr-logo-light')}
    />
  </>
);

export default SeerrLogo;

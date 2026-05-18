import ButtonWithDropdown from '@app/components/Common/ButtonWithDropdown';

interface PlayButtonProps {
  links: PlayButtonLink[];
}

type PlayButtonLinkBase = {
  text: string;
  svg: React.ReactNode;
};

export type PlayButtonLink =
  | (PlayButtonLinkBase & { url: string; onClick?: () => void })
  | (PlayButtonLinkBase & { url?: never; onClick: () => void });

const PlayButton = ({ links }: PlayButtonProps) => {
  if (!links || !links.length) {
    return null;
  }

  const primary = links[0];

  return (
    <ButtonWithDropdown
      as={primary.url ? 'a' : 'button'}
      buttonType="ghost"
      text={
        <>
          {primary.svg}
          <span>{primary.text}</span>
        </>
      }
      href={primary.url}
      onClick={primary.onClick}
      target={primary.url ? '_blank' : undefined}
    >
      {links.length > 1 &&
        links.slice(1).map((link, i) => {
          return (
            <ButtonWithDropdown.Item
              key={`play-button-dropdown-item-${i}`}
              buttonType="ghost"
              href={link.url}
              onClick={link.onClick}
              target={link.url ? '_blank' : undefined}
            >
              {link.svg}
              <span>{link.text}</span>
            </ButtonWithDropdown.Item>
          );
        })}
    </ButtonWithDropdown>
  );
};

export default PlayButton;

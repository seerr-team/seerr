import ButtonWithDropdown from '@app/components/Common/ButtonWithDropdown';

interface PlayButtonProps {
  links: PlayButtonLink[];
}

export interface PlayButtonLink {
  text: string;
  url: string;
  svg: React.ReactNode;
}

const PlayButton = ({ links }: PlayButtonProps) => {
  if (!links || !links.length) {
    return null;
  }

  return (
    <ButtonWithDropdown
      as="a"
      buttonType="glass"
      text={
        <>
          {links[0].svg}
          <span className="whitespace-nowrap">{links[0].text}</span>
        </>
      }
      href={links[0].url}
      target="_blank"
    >
      {links.length > 1 &&
        links.slice(1).map((link, i) => {
          return (
            <ButtonWithDropdown.Item
              key={`play-button-dropdown-item-${i}`}
              buttonType="glass"
              href={link.url}
              target="_blank"
            >
              {link.svg}
              <span className="whitespace-nowrap">{link.text}</span>
            </ButtonWithDropdown.Item>
          );
        })}
    </ButtonWithDropdown>
  );
};

export default PlayButton;

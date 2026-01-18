import type { NotificationItem } from '@app/components/NotificationTypeSelector';
import { hasNotificationType } from '@app/components/NotificationTypeSelector';

interface NotificationTypeProps {
  option: NotificationItem;
  currentTypes: number;
  parent?: NotificationItem;
  onUpdate: (newTypes: number) => void;
}

const NotificationType = ({
  option,
  currentTypes,
  onUpdate,
  parent,
}: NotificationTypeProps) => {
  return (
    <>
      <div
        className={`relative mt-4 flex items-start first:mt-0 ${
          !!parent?.value && hasNotificationType(parent.value, currentTypes)
            ? 'opacity-50'
            : ''
        }`}
      >
        <div className="flex h-6 items-center">
          <input
            id={option.id}
            name="permissions"
            type="checkbox"
            disabled={
              !!parent?.value && hasNotificationType(parent.value, currentTypes)
            }
            onClick={() => {
              onUpdate(
                hasNotificationType(option.value, currentTypes)
                  ? currentTypes - option.value
                  : currentTypes + option.value
              );
            }}
            checked={
              hasNotificationType(option.value, currentTypes) ||
              (!!parent?.value &&
                hasNotificationType(parent.value, currentTypes))
            }
          />
        </div>
        <div className="ml-3 text-sm leading-6">
          <label htmlFor={option.id} className="block" aria-label={option.name}>
            <div className="flex flex-col">
              <span className="font-medium text-white">{option.name}</span>
              <span className="font-normal text-gray-400">
                {option.description}
              </span>
            </div>
          </label>
        </div>
      </div>
      {(option.children ?? []).map((child) => (
        <div key={`notification-type-child-${child.id}`} className="mt-4 pl-6">
          <NotificationType
            option={child}
            currentTypes={currentTypes}
            onUpdate={(newTypes) => onUpdate(newTypes)}
            parent={option}
          />
        </div>
      ))}
    </>
  );
};

export default NotificationType;

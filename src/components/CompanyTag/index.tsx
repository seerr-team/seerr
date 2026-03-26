import Spinner from '@app/assets/spinner.svg';
import Tag from '@app/components/Common/Tag';
import { apiUrl } from '@app/utils/apiUrl';
import { BuildingOffice2Icon } from '@heroicons/react/24/outline';
import type { ProductionCompany, TvNetwork } from '@server/models/common';
import useSWR from 'swr';

type CompanyTagProps = {
  type: 'studio' | 'network';
  companyId: number;
};

const CompanyTag = ({ companyId, type }: CompanyTagProps) => {
  const { data, error } = useSWR<TvNetwork | ProductionCompany>(
    apiUrl(`/${type}/${companyId}`)
  );

  if (!data && !error) {
    return (
      <Tag>
        <Spinner className="h-4 w-4" />
      </Tag>
    );
  }

  return <Tag iconSvg={<BuildingOffice2Icon />}>{data?.name}</Tag>;
};

export default CompanyTag;

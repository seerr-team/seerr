import BookDetails from '@app/components/BookDetails';
import type { BookDetails as BookDetailsType } from '@server/models/Book';
import axios from 'axios';
import type { GetServerSideProps, NextPage } from 'next';

interface BookPageProps {
  book?: BookDetailsType;
}

const BookPage: NextPage<BookPageProps> = ({ book }) => {
  return <BookDetails book={book} />;
};

export const getServerSideProps: GetServerSideProps<BookPageProps> = async (
  ctx
) => {
  const response = await axios.get<BookDetailsType>(
    `http://${process.env.HOST || 'localhost'}:${
      process.env.PORT || 5055
    }/api/v1/book/${ctx.query.bookId}`,
    {
      headers: ctx.req?.headers?.cookie
        ? { cookie: ctx.req.headers.cookie }
        : undefined,
    }
  );

  return {
    props: {
      book: response.data,
    },
  };
};

export default BookPage;

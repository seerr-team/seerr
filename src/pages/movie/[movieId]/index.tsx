import MovieDetails from '@app/components/MovieDetails';
import { withBasePath } from '@app/utils/basePath';
import { getHostAndPort } from '@app/utils/urlHelper';
import type { MovieDetails as MovieDetailsType } from '@server/models/Movie';
import axios from 'axios';
import type { NextPage } from 'next';

interface MoviePageProps {
  movie?: MovieDetailsType;
}

const MoviePage: NextPage<MoviePageProps> = ({ movie }) => {
  return <MovieDetails movie={movie} />;
};

MoviePage.getInitialProps = async (ctx) => {
  const apiPath = `/api/v1/movie/${ctx.query.movieId}`;
  const response = await axios.get<MovieDetailsType>(
    ctx.req ? `http://${getHostAndPort()}${withBasePath(apiPath)}` : apiPath,
    {
      headers: ctx.req?.headers?.cookie
        ? { cookie: ctx.req.headers.cookie }
        : undefined,
    }
  );

  return {
    movie: response.data,
  };
};

export default MoviePage;

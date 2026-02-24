import { useState } from 'react';

export const useNavigate = () => {
  const [currentPage, setCurrentPage] = useState('/login');

  const navigate = (path) => {
    setCurrentPage(path);
  };

  return navigate;
};

export const useCurrentPage = () => {
  const [currentPage, setCurrentPage] = useState('/login');
  return [currentPage, setCurrentPage];
};

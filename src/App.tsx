import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import HomePage from "@/routes/HomePage";
import TrackPage from "@/routes/TrackPage";
import CategoryPage from "@/routes/CategoryPage";
import LessonPage from "@/routes/LessonPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/:tool" element={<TrackPage />} />
        <Route path="/:tool/category/:slug" element={<CategoryPage />} />
        <Route path="/:tool/lesson/:slug" element={<LessonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

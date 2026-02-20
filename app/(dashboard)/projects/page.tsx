"use client";

// anytime we are using any hook, make sure you put this directive at the top

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { ProjectsGrid } from "@/components/projects/ProjectsGrid";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  clerk_id: string;
}

const ProjectsPage = () => {
  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid"); // grid or list

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Grab the JWT token
  const { getToken, userId } = useAuth();
  const router = useRouter();

  // Business logic functions
  // whenever this page is getting mounted, we need to load projects from the server side
  const loadProjects = async () => {
    try {
      setLoading(true);
      // to make an api call, you need access to the JWT token, which you attach in the header
      const token = await getToken();
      const result = await apiClient.get("/api/projects", token);
      const { data } = result || {};
      setProjects(data);
    } catch (err) {
      console.error("Error loading projects", err);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (name: string, description: string) => {
    try {
      setError(null);
      setIsCreating(true);
      const token = await getToken();
      const result = await apiClient.post(
        "/api/projects",
        {
          name: name,
          description: description,
        },
        token,
      );
      const createdProject = result?.data || {};
      setProjects((prev) => [createdProject, ...prev]); // EXPLAIN
      setShowCreateModal(false);
      toast.success("Project created successfully!");
    } catch (err) {
      toast.error("Failed to create project");
      console.error("Error creating project", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      setError(null);
      const token = await getToken();
      const result = await apiClient.delete(
        `/api/projects/${projectId}`,
        token,
      );
      const deletedProject = result?.data || {};
      // setProjects((prev) => prev.filter((obj) => obj !== deletedProject));
      setProjects((prev) => prev.filter((obj) => obj.id !== projectId));

      toast.success("Project deleted successfully!");
    } catch (err) {
      toast.error("Failed to delete project");
      console.error("Error deleting project", err);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleOpenModal = () => {
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
  };

  useEffect(() => {
    if (userId) {
      loadProjects();
    }
  }, [userId]);

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return <LoadingSpinner message="Fetching projects"></LoadingSpinner>;
  }

  return (
    <div>
      <ProjectsGrid
        projects={filteredProjects}
        loading={loading}
        error={error}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onProjectClick={handleProjectClick}
        onCreateProject={handleOpenModal}
        onDeleteProject={handleDeleteProject}
      ></ProjectsGrid>
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        onCreateProject={handleCreateProject}
        isLoading={isCreating}
      ></CreateProjectModal>
    </div>
  );
};

export default ProjectsPage;

import React, { useState, useEffect } from "react";
import './App.css';
// Import the Star icon from a library or define it (assuming you have a way to display stars)
// For this example, we will use basic Unicode stars.

const API_BASE_URL = "http://localhost:5000";

const allIngredients = [
  "ground beef", "breadcrumbs", "egg", "lettuce", "tomato", "thai chili sauce",
  "burger bun", "sirloin steak", "black peppercorns", "cream", "garlic", "butter",
  "olive oil", "bell pepper", "cheese", "tortilla", "sour cream", "enchilada sauce",
  "chicken breast", "cheddar cheese", "garlic powder", "beef stock", "thyme",
  "ground pork", "hoisin sauce", "cucumber", "couscous", "hummus", "olive",
  "feta cheese", "lemon juice", "spaghetti", "chili flakes", "parsley",
  "parmesan cheese", "pizza dough", "mozzarella cheese", "tomato sauce", "basil",
  "scallops", "ravioli", "onion", "arborio rice", "bacon", "mushrooms",
  "white cheddar", "crispy onions", "carrots", "soy sauce", "scallions",
  "lentils", "cumin", "coriander", "chili powder", "chicken tenders", "ginger",
  "brown sugar", "sesame seeds", "chicken thighs", "paprika", "zucchini",
  "rice", "gochujang", "cauliflower", "chickpeas", "curry powder", "cilantro",
  "flour", "coconut milk", "curry paste", "chili", "lime", "tofu", "spinach"
];

// ==========================================================
// ⭐️ NEW: StarRating Component
// ==========================================================
const StarRating = ({ recipeId, currentRating, onRate, disabled }) => {
  const [hover, setHover] = useState(0);
  const maxStars = 5;
  
  // Convert backend rating (e.g., 4.5) to a display value
  const displayRating = currentRating ? parseFloat(currentRating).toFixed(1) : 'N/A';

  return (
    <div className="rating-container">
      <div className="stars">
        {[...Array(maxStars)].map((star, index) => {
          const ratingValue = index + 1;

          return (
            <button
              type="button"
              key={ratingValue}
              className={`star-btn ${ratingValue <= (hover || currentRating) ? "on" : "off"}`}
              onClick={() => !disabled && onRate(recipeId, ratingValue)}
              onMouseEnter={() => !disabled && setHover(ratingValue)}
              onMouseLeave={() => !disabled && setHover(0)}
              disabled={disabled}
            >
              <span className="star-icon">
                {/* Unicode star: ⭐ (filled) or ☆ (empty) */}
                {ratingValue <= (hover || currentRating) ? "★" : "☆"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="rating-score">
        Rating: 
        <span className="score-value" title={`Average score: ${displayRating}`}>
          {displayRating}
        </span>
      </p>
    </div>
  );
};


function App() {
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    title: "",
    description: "",
    thumbnail: "",
    source_url: "",
    ingredients: []
  });
  const [ingredientsText, setIngredientsText] = useState("");

  // ==========================================================
  // 🔄 Existing useEffect to trigger fetching on ingredient/search change
  // ==========================================================
  useEffect(() => {
    // Only fetch if not in trash view
    if (!showTrash) {
      fetchRecipes();
    }
  }, [selectedIngredients, searchTerm, showTrash]); 

  const toggleIngredient = (ingredient) => {
    setSelectedIngredients((prev) =>
      prev.includes(ingredient)
        ? prev.filter((ing) => ing !== ingredient)
        : [...prev, ingredient]
    );
  };

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/recipes`;
      let data;

      if (selectedIngredients.length > 0) {
        // POST request for ingredient-based search
        const res = await fetch(`${API_BASE_URL}/recipes/ingredients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredients: selectedIngredients }),
        });
        
        if (!res.ok) throw new Error("Failed to fetch recipes by ingredients");
        data = await res.json();

        // Apply search term filter if present (if the search was ingredient-based)
        if (searchTerm) {
          data = data.filter((recipe) =>
            recipe.title.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
      } else {
        // GET request for all recipes or search by name
        if (searchTerm) {
          url += `?search=${encodeURIComponent(searchTerm)}`;
        }
        const res = await fetch(url);
        
        if (!res.ok) throw new Error("Failed to fetch recipes");
        data = await res.json();
      }

      setRecipes(data);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      alert("Failed to fetch recipes. Please try again.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrashedRecipes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recipes/trashed`);
      
      if (!res.ok) throw new Error("Failed to fetch trashed recipes");
      const data = await res.json();
      setRecipes(data);
    } catch (err) {
      console.error("Error fetching trashed recipes:", err);
      alert("Failed to fetch trashed recipes. Please try again.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };
  
  // ==========================================================
  // ⭐️ NEW: handleRate function
  // ==========================================================
  const handleRate = async (recipeId, score) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: score })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to submit rating");
      }

      // Update the local state with the new recipe data (which should include the updated average rating)
      const updatedRecipe = await res.json();
      
      setRecipes(prevRecipes =>
        prevRecipes.map(recipe =>
          recipe._id === recipeId ? { ...recipe, rating: updatedRecipe.rating } : recipe
        )
      );

      // Alert or brief notification for successful rating
      // alert(`Successfully rated ${score} stars!`);

    } catch (err) {
      console.error("Error submitting rating:", err);
      alert(err.message || "Failed to submit rating. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  const handleSearch = (e) => {
    e.preventDefault();
    if (showTrash) {
      alert("Search is not available in trash view");
      return;
    }
    // Search term change triggers useEffect
  };

  const handleDelete = async (recipeId) => {
    if (!window.confirm("Are you sure you want to move this recipe to trash?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}`, {
        method: "DELETE"
      });
      
      if (!res.ok) throw new Error("Failed to delete recipe");
      
      alert("Recipe moved to trash!");
      await fetchRecipes();
    } catch (err) {
      console.error("Error deleting recipe:", err);
      alert("Failed to delete recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (recipeId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}/restore`, {
        method: "PATCH"
      });
      
      if (!res.ok) throw new Error("Failed to restore recipe");
      
      alert("Recipe restored successfully!");
      await fetchTrashedRecipes();
    } catch (err) {
      console.error("Error restoring recipe:", err);
      alert("Failed to restore recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (recipeId) => {
    if (!window.confirm("Permanently delete this recipe? This action CANNOT be undone!")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}/permanent`, {
        method: "DELETE"
      });
      
      if (!res.ok) throw new Error("Failed to permanently delete recipe");
      
      alert("Recipe permanently deleted!");
      await fetchTrashedRecipes();
    } catch (err) {
      console.error("Error permanently deleting recipe:", err);
      alert("Failed to permanently delete recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipe = async (e) => {
    e.preventDefault();
    const ingredientsArray = ingredientsText
      .split(",")
      .map(i => i.trim())
      .filter(i => i.length > 0);

    const recipeToSend = { ...newRecipe, ingredients: ingredientsArray };
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipeToSend)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add recipe");
      }
      
      alert("Recipe added successfully!");
      setShowAddModal(false);
      setNewRecipe({ title: "", description: "", thumbnail: "", source_url: "", ingredients: [] });
      
      if (!showTrash) {
        await fetchRecipes();
      }
    } catch (err) {
      console.error("Error adding recipe:", err);
      alert(err.message || "Failed to add recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecipe = async (e) => {
    e.preventDefault();

    const ingredientsArray = ingredientsText
      .split(",")
      .map(i => i.trim())
      .filter(i => i.length > 0);

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recipes/${editingRecipe._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingRecipe.title,
          description: editingRecipe.description,
          thumbnail: editingRecipe.thumbnail,
          source_url: editingRecipe.source_url,
          ingredients: ingredientsArray
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update recipe");
      }
      
      alert("Recipe updated successfully!");
      setShowEditModal(false);
      setEditingRecipe(null);
      
      if (showTrash) {
        await fetchTrashedRecipes();
      } else {
        await fetchRecipes();
      }
    } catch (err) {
      console.error("Error updating recipe:", err);
      alert(err.message || "Failed to update recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (recipe) => {
    setEditingRecipe({ ...recipe });
    setIngredientsText(recipe.ingredients ? recipe.ingredients.join(", ") : "");
    setShowEditModal(true);
  };


  const toggleTrashView = () => {
    setShowTrash(prev => !prev);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewRecipe({ title: "", description: "", thumbnail: "", source_url: "", ingredients: [] });
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingRecipe(null);
  };

  return (
    <div className="container">
      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* Sidebar */}
      <div className="sidebar">
        <h2>Pantry</h2>
        <div className="ingredients">
          {allIngredients.map((ingredient) => (
            <button
              key={ingredient}
              className={`ingredient-btn ${
                selectedIngredients.includes(ingredient) ? "selected" : ""
              }`}
              onClick={() => toggleIngredient(ingredient)}
              disabled={showTrash}
            >
              {ingredient}
            </button>
          ))}
        </div>
        {showTrash && (
          <p className="trash-notice">
            Ingredient filtering is disabled in trash view
          </p>
        )}
      </div>

      {/* Main Content */}
      <div className="content">
        <div className="content-header">
          <img
            src={`${process.env.PUBLIC_URL}/recipe.png`}
            alt="Recipe Recommender Logo"
            className="logo"
          />
          <h2>Recipe Recommender</h2>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="add-recipe-btn" 
            onClick={() => setShowAddModal(true)}
            disabled={loading}
          >
            + Add Recipe
          </button>
          <button 
            className="trash-btn" 
            onClick={toggleTrashView}
            disabled={loading}
          >
            {showTrash ? "← Back to Recipes" : "🗑️ View Trash"}
          </button>
        </div>

        {/* Search Bar */}
        {!showTrash && (
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search recipes by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="search-btn" disabled={loading}>
              Search
            </button>
          </form>
        )}

        {/* Recipe List */}
        {recipes.length > 0 ? (
          <div className="recipe-list">
            {recipes.map((recipe) => (
              <div key={recipe._id} className="recipe-card">
                <img src={recipe.thumbnail} alt={recipe.title} className="recipe-image" />
                <div className="recipe-info">
                  <h3>{recipe.title}</h3>
                  <p>{recipe.description}</p>
                  
                  {/* ⭐️ NEW: Star Rating Component */}
                  {!showTrash && (
                    <StarRating
                      recipeId={recipe._id}
                      currentRating={recipe.rating} // Assume recipe.rating holds the average score
                      onRate={handleRate}
                      disabled={loading}
                    />
                  )}
                  
                  <a
                    href={recipe.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-btn"
                  >
                    View Recipe
                  </a>
                  {recipe.matchedIngredients !== undefined && (
                    <p className="matched">Matched Ingredients: {recipe.matchedIngredients}</p>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="recipe-actions">
                    {showTrash ? (
                      <>
                        <button 
                          className="restore-btn"
                          onClick={() => handleRestore(recipe._id)}
                          disabled={loading}
                        >
                          ↻ Restore
                        </button>
                        <button 
                          className="permanent-delete-btn"
                          onClick={() => handlePermanentDelete(recipe._id)}
                          disabled={loading}
                        >
                          Delete Forever
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className="edit-btn"
                          onClick={() => openEditModal(recipe)}
                          disabled={loading}
                        >
                          ✎ Edit
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => handleDelete(recipe._id)}
                          disabled={loading}
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">
            {loading 
              ? "Loading..." 
              : showTrash 
              ? "No recipes in trash." 
              : "No recipes found. Select ingredients or search by name."}
          </p>
        )}
      </div>

      {/* Add Recipe Modal (omitted for brevity, unchanged) */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeAddModal}>
        {/* ... modal content ... */}
        </div>
      )}

      {/* Edit Recipe Modal (omitted for brevity, unchanged) */}
      {showEditModal && editingRecipe && (
        <div className="modal-overlay" onClick={closeEditModal}>
        {/* ... modal content ... */}
        </div>
      )}
    </div>
  );
}

export default App;
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;
const API_URL = "https://covers.openlibrary.org/b/isbn/9780765319852.json";
let bookItems = [];
let notes = [];
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "book",
  password: "123456",
  port: 5432,
});
db.connect();

async function fetchItems() {
  let result = await db.query(
    "SELECT book.id, book_name, book_isbn, rating, category, name, o_l_id, auther.id FROM book JOIN auther ON auther.id = book.auther_id;"
  );
  if (result.rows.length === 0) {
    // If no items are found, return the default items
    return (bookItems = []);
  }
  // Ensure the items are in the same format as the default items
  bookItems = result.rows.map((item) => ({
    book_id: item.id,
    book_name: item.book_name,
    book_img:
      item.book_isbn[0] === "o" || item.book_isbn[0] === "O"
        ? `https://covers.openlibrary.org/b/olid/${item.book_isbn}-L.jpg`
        : `https://covers.openlibrary.org/b/isbn/${item.book_isbn}-L.jpg`,
    book_isbn: item.book_isbn,
    rating: item.rating,
    category: item.category,
    autherName: item.name,
    auther_id: item.id,
    auther_img: `https://covers.openlibrary.org/a/olid/${item.o_l_id}-S.jpg`,
    openLibraryId: item.o_l_id,
  }));
  console.log("book in database: ", bookItems);
  return bookItems;
}
async function fetchNotes(bookId) {
  let result = await db.query(
    "SELECT id, note FROM notes WHERE book_id = $1;",
    [bookId]
  );
  if (result.rows.length === 0) {
    // If no items are found, return the default items
    return (notes = []);
  }
  // Ensure the items are in the same format as the default items
  notes = result.rows.map((item) => ({
    id: item.id,
    note: item.note,
  }));
  return notes;
}

function getTime() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
  const year = now.getFullYear();

  const formattedDateTime = `${month}/${day}/${year}`;

  //console.log(formattedDateTime); // Example output: 13/08/2025 12:11:00
  return formattedDateTime;
}

app.get("/", async (req, res) => {
  // const response = await axios.get(API_URL);
  // const result = response.data;
  const books = await fetchItems();
  console.log("Data received:");
  res.render("index.ejs", { books });
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});

app.get("/addbook", (req, res) => {
  res.render("addBook.ejs");
});

app.get("/notes/:id", async (req, res) => {
  const bookId = req.params.id;
  const book = bookItems.find((item) => item.book_id === parseInt(bookId));
  if (!book) {
    return res.status(404).send("Book not found");
  }
  res.render("notes.ejs", { book, notes: await fetchNotes(bookId) });
});

app.post("/addbook", async (req, res) => {
  const { book_name, book_isbn, rating, category, autherName, o_l_id } =
    req.body;

  try {
    // Check if the author already exists
    let result = await db.query("SELECT id FROM auther WHERE name = $1", [
      autherName,
    ]);
    let autherId;
    if (result.rows.length > 0) {
      // Author exists, get the id
      autherId = result.rows[0].id;
    } else {
      // Author does not exist, insert new author
      result = await db.query(
        "INSERT INTO auther (name, o_l_id) VALUES ($1, $2) RETURNING id",
        [autherName, o_l_id]
      );
      autherId = result.rows[0].id;
    }

    // Insert the new book
    await db.query(
      "INSERT INTO book (book_name, book_isbn, rating, category, auther_id, reading_date) VALUES ($1, $2, $3, $4, $5, $6)",
      [book_name, book_isbn, rating, category, autherId, getTime()]
    );

    res.redirect("/");
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", async (req, res) => {
  const note = req.body.newNote;
  const bookId = parseInt(req.body.bookId);
  const autherId = parseInt(req.body.authorID);
  console.log("data from notes" + note, bookId, autherId);
  try {
    await db.query(
      "INSERT INTO notes (note, book_id, auther_id) VALUES ($1, $2, $3)",
      [note, bookId, autherId]
    );
    res.redirect("/notes/" + parseInt(bookId));
  } catch (error) {
    console.error("Error adding note:", error);
    res.status(500).send("Internal Server Error");
  }
});

//edit note
app.post("/edit", async (req, res) => {
  const noteId = req.body.noteId;
  const bookId = req.body.bookId;
  const updatedNote = req.body.updatedNote;
  console.log("data from edit notes" + noteId, parseInt(bookId), updatedNote);
  try {
    await db.query("UPDATE notes SET note = $1 WHERE id = $2", [
      updatedNote,
      noteId,
    ]);
    res.redirect("/notes/" + parseInt(bookId));
  } catch (error) {
    console.error("Error updating note:", error);
    res.status(500).send("Internal Server Error");
  }
});

//delete note
app.post("/delete", async (req, res) => {
  const noteId = req.body.noteId;
  const bookId = req.body.bookId;
  try {
    await db.query("DELETE FROM notes WHERE id = $1", [noteId]);
    res.redirect("/notes/" + parseInt(bookId));
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

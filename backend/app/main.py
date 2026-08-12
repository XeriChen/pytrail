import os
import subprocess
import sys
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload
from .auth import create_token, current_user, enforce_secret_key_policy, hash_password, verify_password
from .database import Base, engine, get_db
from .metrics import as_utc_date, compute_streak
from .models import Course, Exercise, Lesson, Progress, User
from .ratelimit import auth_limiter
from .schemas import CourseOut, ExecuteIn, ExerciseSubmit, LoginRequest, ProgressIn, Token, UserCreate, UserOut


@asynccontextmanager
async def lifespan(_app: FastAPI):
    enforce_secret_key_policy()
    Base.metadata.create_all(bind=engine)
    with next(get_db()) as db:
        seed(db)
    yield


app = FastAPI(title="PyTrail Learning API", version="1.0.0", lifespan=lifespan)
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def limit_auth(request: Request) -> None:
    key = f"{request.url.path}:{client_ip(request)}"
    if not auth_limiter.allow(key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

# Curriculum derived from the first 20 days of the Python-100-Days reference.
# Each lesson maps to one day: markdown teaches the concept, starter_code is a
# runnable example for the playground, and expected_answer is graded by exact
# (case-insensitive) string match in /api/exercises/{id}/submit.
CURRICULUM = [
    {
        "title": "Getting Started with Python",
        "duration": 10,
        "markdown": """# Getting Started with Python

Python is a high-level, interpreted language famous for readable syntax and a huge ecosystem. It runs on every major operating system, which makes it a great first language.

Install the CPython interpreter from python.org, then verify in a terminal:

```bash
python --version
```

`pip` installs third-party packages. An editor like VS Code or PyCharm helps, but any text editor works.""",
        "exercises": [
            {"prompt": "Which command prints the Python interpreter version?", "starter_code": "# Run this in a terminal, not in Python:\n# python --version\n\nprint('Python is ready')", "expected_answer": "python"},
        ],
    },
    {
        "title": "Hello, World",
        "duration": 8,
        "markdown": """# Hello, World

The classic first program prints a greeting — one line is enough:

```python
print('hello, world')
```

Strings accept single or double quotes. Statements need no semicolons, and comments start with `#`.

```python
# This is a comment
print("你好，世界")
```""",
        "exercises": [
            {"prompt": "Which built-in function writes text to the screen?", "starter_code": "print('hello, world')\nprint('goodbye, world')", "expected_answer": "print"},
        ],
    },
    {
        "title": "Variables & Types",
        "duration": 12,
        "markdown": """# Variables & Types

A variable is a name that points to a value. Python has four core types: `int`, `float`, `str`, and `bool`.

```python
a = 100
b = 3.14
c = 'hello'
d = True
print(type(a))  # <class 'int'>
```

Convert between types with `int()`, `float()`, `str()`. Inspect any value with `type()`.""",
        "exercises": [
            {"prompt": "What does `type(3.14).__name__` return?", "starter_code": "a = 100\nb = 3.14\nc = 'hello'\nprint(type(a).__name__)\nprint(type(b).__name__)", "expected_answer": "float"},
        ],
    },
    {
        "title": "Operators & Expressions",
        "duration": 12,
        "markdown": """# Operators & Expressions

Python has the usual arithmetic, plus `//` (floor division), `%` (modulo), and `**` (power).

```python
print(7 // 2)   # 3
print(7 % 2)    # 1
print(2 ** 3)   # 8
```

Comparisons produce booleans; `and`, `or`, `not` short-circuit. Format values with f-strings: `f'{x:.2f}'`.""",
        "exercises": [
            {"prompt": "What is the result of `2 ** 3`?", "starter_code": "print(7 // 2)\nprint(7 % 2)\nprint(2 ** 3)", "expected_answer": "8"},
        ],
    },
    {
        "title": "Branching with if",
        "duration": 14,
        "markdown": """# Branching with if

Use `if`, `elif`, and `else` to choose a path. Colons and indentation define each block.

```python
score = 85
if score >= 90:
    grade = 'A'
elif score >= 80:
    grade = 'B'
else:
    grade = 'C'
print(grade)  # B
```

Python 3.10+ adds `match` / `case` for structural pattern matching.""",
        "exercises": [
            {"prompt": "Which keyword introduces an alternative condition after `if`?", "starter_code": "score = 85\nif score >= 90:\n    print('A')\nelif score >= 80:\n    print('B')\nelse:\n    print('C')", "expected_answer": "elif"},
        ],
    },
    {
        "title": "Loops",
        "duration": 14,
        "markdown": """# Loops

`for` iterates over a known sequence; `while` repeats while a condition holds. `range(start, end, step)` is end-exclusive.

```python
total = 0
for i in range(1, 101):
    total += i
print(total)  # 5050
```

`break` exits a loop; `continue` skips to the next iteration.""",
        "exercises": [
            {"prompt": "What is the sum of integers 1 through 100?", "starter_code": "total = 0\nfor i in range(1, 101):\n    total += i\nprint(total)", "expected_answer": "5050"},
            {"prompt": "Which keyword immediately terminates a loop?", "starter_code": "for n in range(10):\n    if n == 3:\n        break\n    print(n)", "expected_answer": "break"},
        ],
    },
    {
        "title": "Branches & Loops in Practice",
        "duration": 16,
        "markdown": """# Branches & Loops in Practice

Classic problems sharpen your control flow: primes, Fibonacci, and digit extraction.

```python
# First 10 Fibonacci numbers
a, b = 0, 1
for _ in range(10):
    a, b = b, a + b
    print(a)
```

Brute-force search (like the hundred-chickens puzzle) shows how nested loops explore combinations.""",
        "exercises": [
            {"prompt": "The 10th Fibonacci number (1, 1, 2, 3, 5, 8, ...) is what?", "starter_code": "a, b = 0, 1\nfor _ in range(10):\n    a, b = b, a + b\n    print(a)", "expected_answer": "55"},
        ],
    },
    {
        "title": "Lists I",
        "duration": 14,
        "markdown": """# Lists I

Lists hold ordered, mutable sequences. Index from `0` forward or `-1` at the end. Slice with `[start:end:step]`.

```python
items = [35, 12, 99, 68, 55]
print(items[0])    # 35
print(items[-1])   # 55
print(items[1:4])  # [12, 99, 68]
print(items[::2])  # [35, 99, 55]
```

Lists also support `+` (concat), `*` (repeat), and `in` (membership).""",
        "exercises": [
            {"prompt": "For `lst = [10, 20, 30, 40]`, what does `lst[-1]` return?", "starter_code": "lst = [10, 20, 30, 40]\nprint(lst[-1])\nprint(lst[::2])", "expected_answer": "40"},
        ],
    },
    {
        "title": "Lists II",
        "duration": 14,
        "markdown": """# Lists II

List methods mutate in place: `append`, `insert`, `remove`, `pop`, `sort`. List comprehensions build lists concisely.

```python
nums = [1, 2, 3]
nums.append(4)
squares = [x ** 2 for x in nums]
print(squares)  # [1, 4, 9, 16]
```

Use `sort()` to order in place, or `sorted()` to return a new list.""",
        "exercises": [
            {"prompt": "What does `[x**2 for x in range(4)]` produce?", "starter_code": "squares = [x**2 for x in range(4)]\nprint(squares)", "expected_answer": "[0, 1, 4, 9]"},
        ],
    },
    {
        "title": "Tuples",
        "duration": 10,
        "markdown": """# Tuples

Tuples are immutable sequences. A single-element tuple needs a trailing comma: `(100,)`. Packing and unpacking make swaps elegant.

```python
a, b = 5, 9
a, b = b, a
print(a, b)  # 9 5
```

Tuples are faster than lists and safe to share across threads.""",
        "exercises": [
            {"prompt": "What is the type of `(100,)` (note the trailing comma)?", "starter_code": "print(type((100,)))\nprint(type((100)))", "expected_answer": "tuple"},
        ],
    },
    {
        "title": "Strings",
        "duration": 14,
        "markdown": """# Strings

Strings are immutable text. Methods return new strings: `upper`, `lower`, `find`, `replace`, `split`, `join`.

```python
s = 'hello, world'
print(s.upper())           # HELLO, WORLD
print(s.replace('o', '@')) # hell@, w@rld
print(s.split())           # ['hello,', 'world']
```

Format with f-strings: `f'{pi:.2f}'` produces `3.14`.""",
        "exercises": [
            {"prompt": "What does `'hello'.upper()` return?", "starter_code": "print('hello'.upper())\nprint('hello, world'.split())", "expected_answer": "HELLO"},
        ],
    },
    {
        "title": "Sets",
        "duration": 10,
        "markdown": """# Sets

Sets are unordered collections of unique values. Membership checks are fast, and duplicates vanish automatically.

```python
print(len({1, 1, 2, 2, 3}))  # 3
```

Operators: `&` (intersection), `|` (union), `-` (difference), `^` (symmetric difference).""",
        "exercises": [
            {"prompt": "Which operator computes the intersection of two sets?", "starter_code": "a = {1, 2, 3, 4}\nb = {3, 4, 5, 6}\nprint(a & b)\nprint(a | b)", "expected_answer": "&"},
        ],
    },
    {
        "title": "Dictionaries",
        "duration": 14,
        "markdown": """# Dictionaries

Dictionaries map keys to values. Keys must be immutable. Use `d[key]` or the safer `d.get(key, default)`.

```python
person = {'name': 'Ada', 'age': 25}
print(person['name'])
print(person.get('email', 'n/a'))
person['email'] = 'ada@example.com'
```

Iterate pairs with `d.items()`, or build with a comprehension: `{k: v for k, v in ...}`.""",
        "exercises": [
            {"prompt": "Which method returns a value for a key without raising an error if the key is missing?", "starter_code": "person = {'name': 'Ada', 'age': 25}\nprint(person.get('email'))", "expected_answer": "get"},
        ],
    },
    {
        "title": "Functions & Modules",
        "duration": 16,
        "markdown": """# Functions & Modules

Functions package reusable logic with `def`. Parameters can have defaults; `*args` and `**kwargs` collect variable arguments.

```python
def fac(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

print(fac(5))  # 120
```

Every `.py` file is a module. Use `import module` or `from module import name`.""",
        "exercises": [
            {"prompt": "Which keyword defines a function in Python?", "starter_code": "def fac(n):\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result\n\nprint(fac(5))", "expected_answer": "def"},
            {"prompt": "What is the factorial of 5 (i.e. `5!`)?", "starter_code": "# 5 * 4 * 3 * 2 * 1 = ?", "expected_answer": "120"},
        ],
    },
    {
        "title": "Functions in Practice",
        "duration": 16,
        "markdown": """# Functions in Practice

Small, focused functions make code readable. Add type hints for clarity: `def is_prime(n: int) -> bool:`.

```python
def is_prime(n: int) -> bool:
    for i in range(2, int(n ** 0.5) + 1):
        if n % i == 0:
            return False
    return True

print(is_prime(37))  # True
```

Compose functions: `lcm(a, b)` can call `gcd(a, b)`.""",
        "exercises": [
            {"prompt": "What is the GCD of 12 and 18?", "starter_code": "def gcd(x, y):\n    while y % x != 0:\n        x, y = y % x, x\n    return x\n\nprint(gcd(12, 18))", "expected_answer": "6"},
        ],
    },
    {
        "title": "Higher-Order Functions",
        "duration": 14,
        "markdown": """# Higher-Order Functions

Functions are first-class: pass them as arguments or return them. `map`, `filter`, and `sorted(key=)` are built-in higher-order functions.

```python
nums = [35, 12, 8, 99, 60]
evens_sq = list(map(lambda x: x ** 2, filter(lambda x: x % 2 == 0, nums)))
print(evens_sq)  # [144, 64, 3600]
```

`lambda` creates a short anonymous function. `functools.reduce` folds a sequence to one value.""",
        "exercises": [
            {"prompt": "What does `list(map(lambda x: x * 2, [1, 2, 3]))` return?", "starter_code": "print(list(map(lambda x: x * 2, [1, 2, 3])))", "expected_answer": "[2, 4, 6]"},
        ],
    },
    {
        "title": "Decorators & Recursion",
        "duration": 16,
        "markdown": """# Decorators & Recursion

A decorator wraps a function to add behavior. Use `@decorator` syntax sugar above the definition.

```python
def shout(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs).upper()
    return wrapper

@shout
def greet(name):
    return f'hello, {name}'

print(greet('Ada'))  # HELLO, ADA
```

Recursion needs a base case. Memoize with `functools.lru_cache` to speed up Fibonacci.""",
        "exercises": [
            {"prompt": "Which `functools` decorator memoizes a function's results?", "starter_code": "from functools import lru_cache\n\n@lru_cache\ndef fib(n):\n    if n in (1, 2):\n        return 1\n    return fib(n - 1) + fib(n - 2)\n\nprint(fib(10))", "expected_answer": "lru_cache"},
        ],
    },
    {
        "title": "OOP Basics",
        "duration": 16,
        "markdown": """# OOP Basics

A class is a blueprint; an object is an instance. `__init__` initializes new objects, and `self` refers to the receiver.

```python
class Student:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def study(self, course):
        print(f'{self.name} is studying {course}.')

Student('Ada', 25).study('Python')  # Ada is studying Python.
```

`__str__` controls how an object prints.""",
        "exercises": [
            {"prompt": "Which keyword defines a class in Python?", "starter_code": "class Student:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age\n\ns = Student('Ada', 25)\nprint(s.name)", "expected_answer": "class"},
        ],
    },
    {
        "title": "Inheritance & Polymorphism",
        "duration": 16,
        "markdown": """# Inheritance & Polymorphism

A subclass extends a parent with `class Child(Parent):`. Call the parent initializer with `super().__init__(...)`. Overriding methods produces polymorphism.

```python
class Person:
    def __init__(self, name):
        self.name = name
    def greet(self):
        return f'Hi, I am {self.name}.'

class Teacher(Person):
    def __init__(self, name, course):
        super().__init__(name)
        self.course = course
    def greet(self):
        return f'{super().greet()} I teach {self.course}.'

print(Teacher('Ada', 'Python').greet())
```

`@property` turns a method into a read-only attribute; `@staticmethod` needs no instance.""",
        "exercises": [
            {"prompt": "Which function calls the parent class's `__init__` method?", "starter_code": "class Person:\n    def __init__(self, name):\n        self.name = name\n\nclass Teacher(Person):\n    def __init__(self, name, course):\n        super().__init__(name)\n        self.course = course\n\nprint(Teacher('Ada', 'Python').name)", "expected_answer": "super"},
        ],
    },
    {
        "title": "OOP in Practice",
        "duration": 18,
        "markdown": """# OOP in Practice

Model real problems with objects: a deck of cards, a payroll system. Enumerations (`enum.Enum`) name symbolic constants, and magic methods like `__lt__` overload operators.

```python
from enum import Enum

class Suite(Enum):
    SPADE, HEART, CLUB, DIAMOND = range(4)

class Card:
    def __init__(self, suite, face):
        self.suite = suite
        self.face = face
    def __repr__(self):
        return f'{self.suite.name}{self.face}'
    def __lt__(self, other):
        return self.suite.value < other.suite.value

print(Card(Suite.HEART, 13))
```

Abstract base classes (`abc.ABCMeta`) define interfaces that subclasses must implement.""",
        "exercises": [
            {"prompt": "Which magic method overloads the `<` operator?", "starter_code": "from enum import Enum\n\nclass Suite(Enum):\n    SPADE, HEART, CLUB, DIAMOND = range(4)\n\nclass Card:\n    def __init__(self, suite, face):\n        self.suite = suite\n        self.face = face\n    def __repr__(self):\n        return f'{self.suite.name}{self.face}'\n\nprint(Card(Suite.HEART, 13))", "expected_answer": "__lt__"},
        ],
    },
]


def seed(db: Session):
    """Seed the Python Foundations course from CURRICULUM.

    If a course already exists and matches the current curriculum shape, do
    nothing. If a stale course is present (older seed with fewer lessons or a
    different first lesson), wipe courses/lessons/exercises/progress and rebuild
    so the new content loads without manual database deletion.
    """
    existing = db.scalar(select(Course).where(Course.slug == "python-foundations"))
    if existing:
        first = db.scalar(select(Lesson).where(Lesson.course_id == existing.id).order_by(Lesson.order))
        if first and first.title == CURRICULUM[0]["title"] and len(existing.lessons) == len(CURRICULUM):
            return
        db.execute(delete(Progress))
        db.execute(delete(Exercise))
        db.execute(delete(Lesson))
        db.execute(delete(Course))
        db.commit()

    course = Course(
        title="Python Foundations",
        slug="python-foundations",
        level="Beginner",
        accent="cyan",
        description="Build a confident Python foundation through short, practical lessons.",
    )
    course.lessons = [
        Lesson(
            title=item["title"],
            order=index + 1,
            duration=item["duration"],
            markdown=item["markdown"],
            exercises=[
                Exercise(prompt=ex["prompt"], starter_code=ex["starter_code"], expected_answer=ex["expected_answer"])
                for ex in item["exercises"]
            ],
        )
        for index, item in enumerate(CURRICULUM)
    ]
    db.add(course)
    db.commit()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "pytrail-api"}


@app.post("/api/auth/register", response_model=Token, status_code=201)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    limit_auth(request)
    if len(payload.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(409, "Email already registered")
    user = User(name=payload.name.strip(), email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_token(user.id), user=user)


@app.post("/api/auth/login", response_model=Token)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    limit_auth(request)
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return Token(access_token=create_token(user.id), user=user)


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@app.get("/api/courses", response_model=list[CourseOut])
def courses(db: Session = Depends(get_db)):
    return db.scalars(select(Course).options(selectinload(Course.lessons).selectinload(Lesson.exercises))).all()


@app.get("/api/courses/{course_id}", response_model=CourseOut)
def course_detail(course_id: int, db: Session = Depends(get_db)):
    course = db.scalar(select(Course).where(Course.id == course_id).options(selectinload(Course.lessons).selectinload(Lesson.exercises)))
    if not course:
        raise HTTPException(404, "Course not found")
    return course


@app.get("/api/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(Lesson.id))) or 0
    completed = db.scalar(select(func.count(Progress.id)).where(Progress.user_id == user.id, Progress.completed.is_(True))) or 0
    avg_score = db.scalar(select(func.avg(Progress.score)).where(Progress.user_id == user.id)) or 0
    stamps = db.scalars(
        select(Progress.updated_at).where(Progress.user_id == user.id, Progress.completed.is_(True))
    ).all()
    streak = compute_streak([as_utc_date(stamp) for stamp in stamps if stamp])
    return {"lessons_total": total, "lessons_completed": completed, "completion": round((completed / total) * 100) if total else 0, "average_score": round(avg_score), "streak": streak}


@app.post("/api/progress")
def update_progress(payload: ProgressIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    progress = db.scalar(select(Progress).where(Progress.user_id == user.id, Progress.lesson_id == payload.lesson_id))
    if not progress:
        progress = Progress(user_id=user.id, lesson_id=payload.lesson_id)
        db.add(progress)
    progress.completed = payload.completed
    progress.score = max(0, min(payload.score, 100))
    db.commit()
    return {"ok": True, "lesson_id": payload.lesson_id, "completed": progress.completed}


@app.post("/api/exercises/{exercise_id}/submit")
def submit_exercise(exercise_id: int, payload: ExerciseSubmit, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exercise = db.get(Exercise, exercise_id)
    if not exercise:
        raise HTTPException(404, "Exercise not found")
    correct = payload.answer.strip().lower() == exercise.expected_answer.lower()
    progress = db.scalar(select(Progress).where(Progress.user_id == user.id, Progress.lesson_id == exercise.lesson_id))
    if not progress:
        progress = Progress(user_id=user.id, lesson_id=exercise.lesson_id)
        db.add(progress)
    progress.score = 100 if correct else 40
    progress.completed = correct
    db.commit()
    return {"correct": correct, "score": progress.score, "message": "Nice work!" if correct else "Almost there - review the lesson and try again."}


@app.post("/api/execute")
def execute(payload: ExecuteIn, user: User = Depends(current_user)):
    del user  # auth is required for attribution; the runner does not use the user record
    if len(payload.code) > 4000:
        raise HTTPException(413, "Code is too long")
    try:
        result = subprocess.run([sys.executable, "-I", "-c", payload.code], capture_output=True, text=True, timeout=2, env={"PATH": os.getenv("PATH", "")})
        return {"ok": result.returncode == 0, "stdout": result.stdout[-4000:], "stderr": result.stderr[-4000:]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": "Execution timed out after 2 seconds."}

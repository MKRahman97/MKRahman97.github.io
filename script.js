// toggle icon navbar
let menuIcon = document.querySelector('#menu-icon');
let navbar = document.querySelector('.navbar');

menuIcon.onclick = () =>{
    menuIcon.classList.toggle('bx-x');
    navbar.classList.toggle('active');
}

// scroll section
let sections = document.querySelectorAll('section');
let navLinks = document.querySelectorAll('header nav a');

window.onscroll = () =>{
    sections.forEach(sec =>{
        let top = window.scrollY;
        let offset = sec.offsetTop-100;
        let height = sec.offsetHeight;
        let id=sec.getAttribute('id')

        if(top >= offset && top < offset+height){
            // activate navbar links
            navLinks.forEach(links =>{
                links.classList.remove('active')
                document.querySelector('header nav a[href*=' + id + ']').classList.add('active');
            });
        }
    });


    // sticky header
    let header = document.querySelector('header');
    header.classList.toggle('sticky', window.scrollY>100);

    // remove toggle and navbar
    menuIcon.classList.remove('bx-x');
    navbar.classList.remove('active');

}


// read more button

function myFunction() {
  let dots = document.getElementById("dots");
  let moreText = document.getElementById("more");
  let btnText = document.getElementById("readmore");

  if (dots.style.display === "none") {
    dots.style.display = "inline";
    btnText.innerHTML = "Read more";
    moreText.style.display = "none";
  } else {
    dots.style.display = "none";
    btnText.innerHTML = "Read less";
    moreText.style.display = "inline";
  }
}

document.getElementById("readmore").addEventListener("click", function() {
    this.classList.toggle("active"); // Toggle the 'active' class on click
});

const scriptURL = 'https://script.google.com/macros/s/AKfycbzdQtwWv81nyKrOGK-kQWvGqQPOTkKn2gR9B3yuAHs6w8OWbiP17GeGl3W_voQvMqCt/exec'
const form = document.forms['submit-to-google-sheet']
const msg = document.getElementById("msg")

form.addEventListener('submit', e => {
e.preventDefault()
fetch(scriptURL, { method: 'POST', body: new FormData(form)})
  .then(response => {
      msg.innerHTML="Message sent successfully"
      setTimeout(function (){
          msg.innerHTML=""
      },10000)
      form.reset()
  })
  .catch(error => console.error('Error!', error.message))
})
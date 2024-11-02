// todo
function createButton(): void {
  const buttonContainer = document.getElementById("button-container");
  if (buttonContainer === null) {
    return;
  }

  const newButton = document.createElement("button");
  newButton.innerText = "Click to see message!";
  newButton.addEventListener("click", () => {
    alert("you clicked the button!");
  });

  buttonContainer.appendChild(newButton);
}

globalThis.onload = () => {
  createButton();
};
